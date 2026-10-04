import { NextRequest } from "next/server";
import { and, eq, gt } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { transcriptLines, approvals, calls } from "@/lib/db/schema";
import type { StreamEvent } from "@/lib/bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/calls/:id/stream — Server-Sent Events (§5.8).
//
// On serverless, in-process pub/sub can't span instances, so this handler polls
// Neon every 500ms for new transcript_lines/approvals. It replays existing
// lines on connect so a page refresh resumes cleanly. For lowest latency, run
// the app as a single Node process and swap in the in-process bus (lib/bus.ts).
const POLL_MS = 500;

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: callId } = await ctx.params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (evt: StreamEvent) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`));

      let lastSeq = 0;
      const seenApprovals = new Set<string>();
      let closed = false;

      try {
        const db = getDb();

        while (!closed) {
          // New transcript lines.
          const lines = await db
            .select()
            .from(transcriptLines)
            .where(and(eq(transcriptLines.callId, callId), gt(transcriptLines.seq, lastSeq)))
            .orderBy(transcriptLines.seq);
          for (const l of lines) {
            lastSeq = Math.max(lastSeq, l.seq);
            send({
              type: "line",
              seq: l.seq,
              speaker: l.speaker as "agent" | "rep",
              en: l.textEn ?? "",
              tr: l.textTranslated ?? "",
              numbers_ok: l.numbersOk ?? true,
            });
          }

          // Pending approvals.
          const pending = await db
            .select()
            .from(approvals)
            .where(and(eq(approvals.callId, callId), eq(approvals.status, "pending")));
          for (const a of pending) {
            if (seenApprovals.has(a.id)) continue;
            seenApprovals.add(a.id);
            send({
              type: "approval",
              id: a.id,
              summary: a.summaryTranslated ?? a.summaryEn ?? "",
              summary_en: a.summaryEn ?? undefined,
              expires_at: new Date(a.requestedAt.getTime() + 45_000).toISOString(),
            });
          }

          // Call status / end.
          const [call] = await db.select().from(calls).where(eq(calls.id, callId)).limit(1);
          if (call) {
            const status = (call.status ?? "dialing") as
              | "dialing"
              | "live"
              | "ended"
              | "failed"
              | "killed";
            send({ type: "status", status });
            if (["ended", "failed", "killed"].includes(status)) break;
          }

          await new Promise((r) => setTimeout(r, POLL_MS));
        }
      } catch {
        // No DB configured (scaffold) or transient error: emit a dialing status
        // and close gracefully rather than crashing the stream.
        send({ type: "status", status: "dialing" });
      } finally {
        closed = true;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
