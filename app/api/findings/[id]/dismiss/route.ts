import { NextRequest } from "next/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { ok, failMsg } from "@/lib/response";
import { findingById } from "@/lib/checkup/findings";
import { getDb } from "@/lib/db/client";
import { dismissals, findings } from "@/lib/db/schema";
import { writeAudit } from "@/lib/audit";
import { ensureUser, savedLanguage } from "@/lib/user";

export const runtime = "nodejs";

async function body(req: NextRequest): Promise<{ lang: string }> {
  const json = (await req.json().catch(() => ({}))) as { lang?: string };
  return { lang: json.lang ?? (await savedLanguage()) ?? "en" };
}

// POST /api/findings/:id/dismiss — "This is normal". The charge amount becomes
// the merchant's accepted baseline, so the same amount is not flagged again.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { lang } = await body(req);
  const finding = await findingById(id);
  if (!finding) return failMsg("not_found", "Finding not found", 404);
  const userId = await ensureUser(lang);
  if (!userId) return failMsg("no_user", "Could not save (database unavailable)", 503);

  const db = getDb();
  await db.insert(dismissals).values({
    userId,
    findingId: finding.id,
    merchant: finding.merchant,
    acceptedAmountCents: finding.afterCents,
  });
  await db
    .insert(findings)
    .values({ id: finding.id, userId, type: finding.type, merchant: finding.merchant, data: finding, confidence: finding.confidence, status: "dismissed" })
    .onConflictDoUpdate({ target: [findings.userId, findings.id], set: { status: "dismissed", updatedAt: sql`now()` } });
  await writeAudit({
    actor: "user",
    event: "finding.dismissed",
    userId,
    findingId: finding.id,
    payload: { merchant: finding.merchant, accepted_amount_cents: finding.afterCents },
  });
  return ok({ dismissed: finding.id });
}

// DELETE /api/findings/:id/dismiss — Undo.
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { lang } = await body(req);
  const userId = await ensureUser(lang);
  if (!userId) return failMsg("no_user", "Could not save (database unavailable)", 503);

  const db = getDb();
  const undone = await db
    .update(dismissals)
    .set({ undoneAt: new Date() })
    .where(and(eq(dismissals.userId, userId), eq(dismissals.findingId, id), isNull(dismissals.undoneAt)))
    .returning({ id: dismissals.id });
  await db
    .update(findings)
    .set({ status: "open", updatedAt: new Date() })
    .where(and(eq(findings.userId, userId), eq(findings.id, id)));
  if (undone.length) await writeAudit({ actor: "user", event: "finding.undismissed", userId, findingId: id });
  return ok({ restored: id, changed: undone.length });
}
