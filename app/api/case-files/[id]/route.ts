import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { ok, failMsg } from "@/lib/response";
import { loadStoredCase } from "@/lib/case-files";
import { getDb } from "@/lib/db/client";
import { caseFiles } from "@/lib/db/schema";
import { writeAudit } from "@/lib/audit";
import { centsToDollars } from "@/lib/money";

export const runtime = "nodejs";

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

const Patch = z.object({
  walkaway_cents: z.number().int().min(0).max(1_000_000),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return failMsg("bad_request", parsed.error.message, 400);

  try {
    const stored = await loadStoredCase(id);
    if (!stored) return failMsg("not_found", "Case file not found", 404);

    const caseFile = {
      ...stored.caseFile,
      walkaway_monthly: centsToDollars(parsed.data.walkaway_cents),
    };
    const db = getDb();
    await db
      .update(caseFiles)
      .set({
        walkawayCents: parsed.data.walkaway_cents,
        explanationI18n: {
          ...stored.explanationI18n,
          case_file: caseFile,
        },
      })
      .where(eq(caseFiles.id, id));

    await writeAudit({
      actor: "user",
      event: "case.walkaway_updated",
      caseFileId: id,
      payload: { walkaway_cents: parsed.data.walkaway_cents },
    });

    return ok({ walkaway_cents: parsed.data.walkaway_cents, case_file: caseFile });
  } catch (err) {
    return failMsg("case_patch_failed", String(err), 500);
  }
}
