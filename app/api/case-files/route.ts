import { NextRequest } from "next/server";
import { z } from "zod";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ok, failMsg } from "@/lib/response";
import { buildCaseFile } from "@/lib/gemini/analyst";
import { BillExtraction, Intent } from "@/lib/schemas";

export const runtime = "nodejs";

// POST /api/case-files — bill + intent (+ optional Nessie customer) -> CaseFile
// + explanation in the user's language (FR-9, FR-10).
const Body = z.object({
  extraction: BillExtraction,
  intent: Intent,
  lang: z.string(),
  nessie_customer_id: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return failMsg("bad_request", parsed.error.message, 400);

  try {
    // TODO(B): if nessie_customer_id, fetch accounts/bills/purchases for leverage.
    const competitorPlans = JSON.parse(
      readFileSync(join(process.cwd(), "data", "competitor_plans.json"), "utf8"),
    );

    const result = await buildCaseFile({
      extraction: parsed.data.extraction,
      intent: parsed.data.intent,
      competitorPlans,
      targetLang: parsed.data.lang,
    });

    // TODO(B): insert case_files, writeAudit(case.created), return real id.
    return ok({ case_file: result.case_file, explanation: result.explanation });
  } catch (err) {
    return failMsg("analyst_failed", String(err), 500);
  }
}
