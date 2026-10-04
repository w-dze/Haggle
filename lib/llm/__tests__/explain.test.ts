import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { detect } from "@/lib/detect/index";
import { inputFromPersona } from "@/lib/detect/adapt";
import { generateMaria } from "@/lib/persona/generate";
import { readDemoInbox } from "@/lib/inbox/fixture";
import { extractBillEvent } from "@/lib/inbox/extract";
import { explainFinding, type CachedRow, type ExplanationCache, type LlmProvider } from "@/lib/llm";
import { allowedNumbers, buildFacts } from "../facts";
import { templateExplanation, type Lang } from "../templates";
import { validatePair } from "../validate";

const events = readDemoInbox().map((m) => extractBillEvent(m));
const findings = detect(inputFromPersona(generateMaria(), events)).findings;
const northwind = findings.find((f) => f.display === "Northwind Internet")!;
const LANGS: Lang[] = ["en", "es", "zh", "ko"];

function memoryCache(): ExplanationCache & { rows: Map<string, CachedRow> } {
  const rows = new Map<string, CachedRow>();
  return {
    rows,
    async get(id, lang) {
      return rows.get(`${id}:${lang}`) ?? null;
    },
    async set(r) {
      rows.set(`${r.findingId}:${r.lang}`, { body: r.body, enBody: r.enBody, source: r.source });
    },
  };
}

/** A provider that returns the template (optionally tampered with). */
function fakeProvider(tamper?: (text: string) => string, fail = false): LlmProvider & { calls: number } {
  const p = {
    name: "fake",
    supportsImages: false,
    calls: 0,
    async explainFinding(req: Parameters<LlmProvider["explainFinding"]>[0]) {
      p.calls += 1;
      if (fail) throw new Error("rate limited");
      const t = (x: typeof req.draft) => ({ ...x, what: x.what.map((w) => (tamper ? tamper(w) : w)) });
      return { body: t(req.draft), en: t(req.draftEn) };
    },
    async translate(text: string) {
      return text;
    },
  };
  return p;
}

describe("templates", () => {
  test("every Maria finding's template passes validation in all four languages", () => {
    for (const f of findings) {
      const facts = buildFacts(f, events);
      for (const lang of LANGS) {
        const check = validatePair(templateExplanation(facts, lang), templateExplanation(facts, "en"), allowedNumbers(facts));
        assert.ok(check.ok, `${f.display} ${lang}: ${!check.ok && check.reason}`);
      }
    }
  });

  test("insurance explanations only suggest questions", () => {
    const summit = findings.find((f) => f.category === "insurance")!;
    const t = templateExplanation(buildFacts(summit, events), "en");
    assert.ok(t.questions.length >= 2);
  });

  test("no template mentions an unfair price", () => {
    for (const f of findings)
      for (const lang of LANGS) {
        const all = Object.values(templateExplanation(buildFacts(f, events), lang)).flat().join(" ");
        assert.ok(!/unfair|injust|不公平|불공정/i.test(all));
      }
  });
});

describe("explainFinding fallback chain", () => {
  test("LLM output that passes validation is used and cached", async () => {
    const cache = memoryCache();
    const provider = fakeProvider();
    const out = await explainFinding(northwind, "es", { billEvents: events, provider, cache });
    assert.equal(out.source, "llm");
    assert.equal(cache.rows.size, 1);
  });

  test("second request is served from cache without calling the LLM", async () => {
    const cache = memoryCache();
    const provider = fakeProvider();
    await explainFinding(northwind, "zh", { billEvents: events, provider, cache });
    const again = await explainFinding(northwind, "zh", { billEvents: events, provider, cache });
    assert.equal(again.source, "cached");
    assert.equal(provider.calls, 1);
  });

  test("an invented number falls back to the template (after one retry)", async () => {
    const cache = memoryCache();
    const provider = fakeProvider((w) => w.replace("$89.00", "$99.00"));
    const out = await explainFinding(northwind, "es", { billEvents: events, provider, cache });
    assert.equal(out.source, "template");
    assert.match(out.fallbackReason ?? "", /number 99/);
    assert.equal(provider.calls, 2);
    assert.equal(cache.rows.size, 0, "templates are not cached");
  });

  test("a provider error falls back to the template without retrying", async () => {
    const provider = fakeProvider(undefined, true);
    const out = await explainFinding(northwind, "ko", { billEvents: events, provider, cache: memoryCache() });
    assert.equal(out.source, "template");
    assert.equal(provider.calls, 1);
  });

  test("no API key: template, with the reason", async () => {
    const out = await explainFinding(northwind, "en", { billEvents: events, provider: null, cache: memoryCache() });
    assert.equal(out.source, "template");
    assert.match(out.fallbackReason ?? "", /no API key/);
  });

  test("a stale cached explanation (numbers no longer match) is rejected", async () => {
    const cache = memoryCache();
    const stale = JSON.stringify({ what: ["It went up to $79.00."], causes: [], actions: [], questions: [] });
    cache.rows.set(`${northwind.id}:en`, { body: stale, enBody: stale, source: "cached" });
    const out = await explainFinding(northwind, "en", { billEvents: events, provider: null, cache });
    assert.equal(out.source, "template");
  });
});
