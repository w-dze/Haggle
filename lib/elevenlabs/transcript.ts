import { eq, desc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { transcriptLines } from "@/lib/db/schema";
import { translateLine } from "@/lib/gemini/translate";
import { publish } from "@/lib/bus";

// Single ingestion point for every transcript turn, regardless of transport
// (§4.6). Whether a turn arrives via realtime events, polling, or the log_turn
// tool, it flows through here so the rest of the pipeline is identical.
//
// Decision rule (hour-2 spike): pick the first transport that delivers a turn
// to the server in <= 2s; set `source` accordingly ("realtime"|"poll"|"log_turn").
export async function ingestTurn(
  callId: string,
  speaker: "agent" | "rep",
  text: string,
  source: "realtime" | "poll" | "log_turn",
  targetLang: string,
): Promise<void> {
  const db = getDb();

  // Next sequence number for this call.
  const [last] = await db
    .select({ seq: transcriptLines.seq })
    .from(transcriptLines)
    .where(eq(transcriptLines.callId, callId))
    .orderBy(desc(transcriptLines.seq))
    .limit(1);
  const seq = (last?.seq ?? 0) + 1;

  // Context = previous 3 lines (English).
  const prev = await db
    .select({ textEn: transcriptLines.textEn })
    .from(transcriptLines)
    .where(eq(transcriptLines.callId, callId))
    .orderBy(desc(transcriptLines.seq))
    .limit(3);
  const context = prev.map((p) => p.textEn ?? "").reverse();

  const { text: tr, numbersOk } = await translateLine({
    textEn: text,
    context,
    targetLang,
  });

  await db.insert(transcriptLines).values({
    callId,
    seq,
    speaker,
    textEn: text,
    textTranslated: tr,
    lang: targetLang,
    numbersOk,
    source,
  });

  publish(callId, { type: "line", seq, speaker, en: text, tr, numbers_ok: numbersOk });
}
