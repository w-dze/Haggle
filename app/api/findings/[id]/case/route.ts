import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { ok, failMsg } from "@/lib/response";
import { demoBillEvents, findingById } from "@/lib/checkup/findings";
import { buildCaseFromFinding } from "@/lib/checkup/case-from-finding";
import { getDb } from "@/lib/db/client";
import { caseFiles, findings } from "@/lib/db/schema";
import { writeAudit } from "@/lib/audit";
import { ensureUser, savedLanguage } from "@/lib/user";

export const runtime = "nodejs";

// POST /api/findings/:id/case — "Call about this". Creates a case file
// pre-filled from the finding; the existing case → call → debrief flow
// takes it from there. No call API or voice code is involved here.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const json = (await req.json().catch(() => ({}))) as { lang?: string };
  const lang = json.lang ?? (await savedLanguage()) ?? "en";

  const finding = await findingById(id);
  if (!finding) return failMsg("not_found", "Finding not found", 404);
  // An anonymous user id cookie, also from the /demo phone, so a finished call
  // shows up under "Resolved" for this browser. The language cookie is untouched.
  const userId = await ensureUser(lang);
  if (!userId) return failMsg("no_user", "Could not save (database unavailable)", 503);

  const built = buildCaseFromFinding(finding, demoBillEvents(), lang);
  const db = getDb();
  const [row] = await db
    .insert(caseFiles)
    .values({
      userId,
      findingId: finding.id,
      intent: built.intent,
      currentCents: built.currentCents,
      targetCents: built.targetCents,
      walkawayCents: built.walkawayCents,
      allowedConcessions: built.caseFile.allowed_concessions,
      forbidden: built.caseFile.forbidden,
      leverage: built.caseFile.leverage,
      competitorOffers: built.caseFile.competitor_offers,
      explanationI18n: { case_file: built.caseFile, ...built.summaries },
      status: "draft",
    })
    .returning({ id: caseFiles.id });

  await db
    .insert(findings)
    .values({ id: finding.id, userId, type: finding.type, merchant: finding.merchant, data: finding, confidence: finding.confidence, status: "called" })
    .onConflictDoUpdate({ target: [findings.userId, findings.id], set: { status: "called", updatedAt: sql`now()` } });
  await writeAudit({
    actor: "user",
    event: "finding.call_started",
    userId,
    findingId: finding.id,
    caseFileId: row.id,
    payload: { kind: built.kind, current_cents: built.currentCents, target_cents: built.targetCents },
  });
  return ok({ case_file_id: row.id, kind: built.kind });
}
