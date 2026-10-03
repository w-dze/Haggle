import { NextRequest } from "next/server";
import { ok, failMsg } from "@/lib/response";
import { loadStoredCase } from "@/lib/case-files";

export const runtime = "nodejs";

// GET /api/case-files/:id — stored case file + localized explanation.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const stored = await loadStoredCase(id);
    if (!stored) return failMsg("not_found", "Case file not found", 404);
    return ok({
      id: stored.id,
      status: stored.status,
      case_file: stored.caseFile,
      explanation_i18n: stored.explanationI18n,
      walkaway_cents: stored.walkawayCents,
    });
  } catch (err) {
    return failMsg("case_load_failed", String(err), 500);
  }
}
