import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { calls, outcomes, transcriptLines } from "@/lib/db/schema";
import { Debrief } from "@/lib/schemas";

export async function loadCallOutcome(callId: string) {
  const db = getDb();
  const [call] = await db.select().from(calls).where(eq(calls.id, callId)).limit(1);
  if (!call) return null;
  const [outcome] = await db
    .select()
    .from(outcomes)
    .where(eq(outcomes.callId, callId))
    .orderBy(desc(outcomes.id))
    .limit(1);
  const lines = await db
    .select()
    .from(transcriptLines)
    .where(eq(transcriptLines.callId, callId))
    .orderBy(transcriptLines.seq);
  return { call, outcome, lines };
}

export function debriefFromOutcome(
  outcome: typeof outcomes.$inferSelect | undefined,
  lang: string,
): Debrief | null {
  if (!outcome?.debriefI18n || typeof outcome.debriefI18n !== "object") return null;
  const bag = outcome.debriefI18n as Record<string, unknown>;
  const raw = bag[lang] ?? bag.en;
  const parsed = Debrief.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
