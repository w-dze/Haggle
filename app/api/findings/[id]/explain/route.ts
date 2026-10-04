import { NextRequest } from "next/server";
import { ok, failMsg } from "@/lib/response";
import { demoBillEvents, findingById } from "@/lib/checkup/findings";
import { explainFinding, seedFileCache } from "@/lib/llm";
import { writeAudit } from "@/lib/audit";
import { env } from "@/lib/env";

export const runtime = "nodejs";

// GET /api/findings/:id/explain?lang=es[&mock=1]
// Explanation in the user's language with English alongside. Order: cache
// (Neon, then pre-generated file) → LLM → template. `source` tells the UI which.
// Mock mode never calls the LLM or the database.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const lang = req.nextUrl.searchParams.get("lang") ?? "en";
  const mock = req.nextUrl.searchParams.get("mock") === "1";

  const finding = await findingById(id, { mock });
  if (!finding) return failMsg("not_found", "Finding not found", 404);

  const explanation = await explainFinding(finding, lang, {
    billEvents: demoBillEvents(),
    // Mock mode reads only the committed pre-generated file.
    ...(mock ? { useLlm: false, cache: seedFileCache } : {}),
  });

  if (!mock && env.DATABASE_URL) {
    await writeAudit({
      actor: "user",
      event: "finding.explained",
      findingId: finding.id,
      payload: { lang: explanation.lang, source: explanation.source },
    }).catch((err) => console.warn(`[audit] finding.explained not written: ${err}`));
  }

  return ok({
    finding_id: finding.id,
    lang: explanation.lang,
    source: explanation.source,
    fallback_reason: explanation.fallbackReason ?? null,
    body: explanation.body,
    en: explanation.en,
  });
}
