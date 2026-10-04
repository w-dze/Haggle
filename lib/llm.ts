import { readFileSync } from "node:fs";
import { join } from "node:path";
import { and, eq } from "drizzle-orm";
import { env } from "@/lib/env";
import type { BillEventFact, Finding } from "@/lib/detect/types";
import { allowedNumbers, buildFacts } from "@/lib/llm/facts";
import { xaiProvider } from "@/lib/llm/providers/xai";
import { templateExplanation, type ExplanationSections, type Lang } from "@/lib/llm/templates";
import type { Explanation, LlmProvider } from "@/lib/llm/types";
import { numbersIn, validatePair } from "@/lib/llm/validate";

// The one entry point for LLM work in the bill check-up. Provider-agnostic:
// LLM_PROVIDER picks the implementation and its key is read from server env.
// The LLM only phrases explanations and translates; every number, finding and
// confidence level comes from lib/detect. Server-only: never import from a
// client component.

export type { Explanation, ExplanationSource, LlmProvider } from "@/lib/llm/types";

const PROVIDERS: Record<string, { provider: LlmProvider; ready: () => boolean }> = {
  xai: { provider: xaiProvider, ready: () => Boolean(env.XAI_API_KEY) },
};

/** The configured provider, or null when it has no API key. */
export function getProvider(): LlmProvider | null {
  const entry = PROVIDERS[env.LLM_PROVIDER];
  return entry && entry.ready() ? entry.provider : null;
}

const LANGS: Lang[] = ["en", "es", "zh", "ko"];
export const asLang = (lang: string): Lang => (LANGS.includes(lang as Lang) ? (lang as Lang) : "en");

// ---- Explanation cache (Neon, then the committed pre-generated file) ---------

export type CachedRow = { body: string; enBody: string; source: string };

export type ExplanationCache = {
  get(findingId: string, lang: Lang): Promise<CachedRow | null>;
  set(row: { findingId: string; lang: Lang; body: string; enBody: string; source: "llm" | "cached" }): Promise<void>;
};

let seedFile: Record<string, CachedRow> | null | undefined;
function readSeedFile(): Record<string, CachedRow> | null {
  if (seedFile !== undefined) return seedFile;
  try {
    seedFile = JSON.parse(readFileSync(join(process.cwd(), "data", "explanations.seed.json"), "utf8")).explanations;
  } catch {
    seedFile = null;
  }
  return seedFile ?? null;
}

/** Read-only: the committed pre-generated explanations. Used in mock mode. */
export const seedFileCache: ExplanationCache = {
  async get(findingId, lang) {
    return readSeedFile()?.[`${findingId}:${lang}`] ?? null;
  },
  async set() {},
};

export const dbCache: ExplanationCache = {
  async get(findingId, lang) {
    if (env.DATABASE_URL) {
      try {
        const { getDb } = await import("@/lib/db/client");
        const { explanations } = await import("@/lib/db/schema");
        const [row] = await getDb()
          .select()
          .from(explanations)
          .where(and(eq(explanations.findingId, findingId), eq(explanations.lang, lang)))
          .limit(1);
        if (row) return { body: row.body, enBody: row.enBody, source: row.source };
      } catch (err) {
        console.warn(`[llm] explanation cache unavailable: ${err instanceof Error ? err.message : err}`);
      }
    }
    return readSeedFile()?.[`${findingId}:${lang}`] ?? null;
  },
  async set(row) {
    if (!env.DATABASE_URL) return;
    try {
      const { getDb } = await import("@/lib/db/client");
      const { explanations } = await import("@/lib/db/schema");
      await getDb()
        .insert(explanations)
        .values({ ...row, generatedAt: new Date() })
        .onConflictDoUpdate({
          target: [explanations.findingId, explanations.lang],
          set: { body: row.body, enBody: row.enBody, source: row.source, generatedAt: new Date() },
        });
    } catch (err) {
      console.warn(`[llm] could not cache explanation: ${err instanceof Error ? err.message : err}`);
    }
  },
};

// ---- Public API ----------------------------------------------------------------

function parseSections(json: string): ExplanationSections | null {
  try {
    const s = JSON.parse(json) as ExplanationSections;
    return Array.isArray(s.what) && Array.isArray(s.causes) && Array.isArray(s.actions) && Array.isArray(s.questions)
      ? s
      : null;
  } catch {
    return null;
  }
}

/**
 * Explanation for one finding: Neon/pre-generated cache → LLM → template.
 * Cached and LLM text is re-validated against the finding's current numbers,
 * so a stale or invented figure is never shown. Never throws.
 */
export async function explainFinding(
  finding: Finding,
  lang: string,
  opts: { billEvents?: BillEventFact[]; provider?: LlmProvider | null; cache?: ExplanationCache; useLlm?: boolean } = {},
): Promise<Explanation> {
  const l = asLang(lang);
  const facts = buildFacts(finding, opts.billEvents);
  const allowed = allowedNumbers(facts);
  const draft = templateExplanation(facts, l);
  const draftEn = l === "en" ? draft : templateExplanation(facts, "en");
  const cache = opts.cache ?? dbCache;
  const log = (source: string, note = "") => console.info(`[llm] explain ${finding.id} ${l}: ${source}${note ? ` (${note})` : ""}`);

  const cached = await cache.get(finding.id, l).catch(() => null);
  if (cached) {
    const body = parseSections(cached.body);
    const en = parseSections(cached.enBody);
    const check = body && en ? validatePair(body, en, allowed) : { ok: false as const, reason: "unreadable cache row" };
    if (body && en && check.ok) {
      log("cached", `stored as ${cached.source}`);
      return { findingId: finding.id, lang: l, body, en, source: "cached" };
    }
    log("cache rejected", check.ok ? "" : check.reason);
  }

  let reason = "";
  const provider = opts.provider === undefined ? getProvider() : opts.provider;
  if (opts.useLlm === false) reason = "LLM disabled for this request";
  else if (!provider) reason = `no API key for LLM_PROVIDER=${env.LLM_PROVIDER}`;
  else {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const out = await provider.explainFinding({ facts, lang: l, draft, draftEn });
        const body = l === "en" ? out.en : out.body;
        const check = validatePair(body, out.en, allowed);
        if (check.ok) {
          await cache.set({
            findingId: finding.id,
            lang: l,
            body: JSON.stringify(body),
            enBody: JSON.stringify(out.en),
            source: "llm",
          });
          log("llm", `${provider.name}, attempt ${attempt}`);
          return { findingId: finding.id, lang: l, body, en: out.en, source: "llm" };
        }
        reason = `validation failed: ${check.reason}`;
      } catch (err) {
        reason = `${provider.name} error: ${err instanceof Error ? err.message : String(err)}`;
        break; // don't retry outages or rate limits
      }
    }
  }

  log("template", reason);
  return { findingId: finding.id, lang: l, body: draft, en: draftEn, source: "template", fallbackReason: reason };
}

/** Translate short English text. Falls back to the English when numbers don't survive. */
export async function translate(
  text: string,
  lang: string,
  opts: { provider?: LlmProvider | null } = {},
): Promise<{ text: string; source: "llm" | "fallback"; reason?: string }> {
  const l = asLang(lang);
  if (l === "en") return { text, source: "llm" };
  const provider = opts.provider === undefined ? getProvider() : opts.provider;
  if (!provider) return { text, source: "fallback", reason: "no LLM provider configured" };
  try {
    const out = await provider.translate(text, l);
    const a = numbersIn(text).sort((x, y) => x - y);
    const b = numbersIn(out).sort((x, y) => x - y);
    if (a.length === b.length && a.every((v, i) => v === b[i])) return { text: out, source: "llm" };
    console.warn(`[llm] translate: numbers changed, showing English`);
    return { text, source: "fallback", reason: "numbers changed in translation" };
  } catch (err) {
    console.warn(`[llm] translate failed: ${err instanceof Error ? err.message : err}`);
    return { text, source: "fallback", reason: "provider error" };
  }
}

export class ImagesNotSupported extends Error {
  constructor(provider: string) {
    super(`${provider} cannot read images; use the paste-text box or the demo inbox instead.`);
  }
}

/** Read bill fields from a photo. Throws ImagesNotSupported when the provider can't. */
export async function extractBillFromImage(image: { mimeType: string; base64: string }) {
  const provider = getProvider();
  if (!provider) throw new Error(`No API key for LLM_PROVIDER=${env.LLM_PROVIDER}`);
  if (!provider.supportsImages || !provider.extractBillFromImage) throw new ImagesNotSupported(provider.name);
  return provider.extractBillFromImage(image);
}
