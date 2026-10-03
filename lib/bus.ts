// In-process pub/sub for SSE fan-out (§5.8).
//
// IMPORTANT: on serverless (Vercel) this bus does NOT span function instances.
// The SSE handler therefore falls back to polling Neon for new transcript_lines
// and approvals (see app/api/calls/[id]/stream/route.ts). This in-process bus
// is the fast path when the app runs as a single long-lived Node process
// (`next start` on a laptop/VM) — the recommended demo setup if latency bites.

export type StreamEvent =
  | { type: "status"; status: "dialing" | "live" | "ended" | "failed" | "killed" }
  | { type: "line"; seq: number; speaker: "agent" | "rep"; en: string; tr: string; numbers_ok: boolean }
  | { type: "approval"; id: string; summary: string; expires_at: string }
  | { type: "approval_resolved"; id: string; status: "yes" | "no" | "timeout" }
  | { type: "outcome"; result: string; old: number; new: number }
  | { type: "debrief"; text: string };

type Listener = (evt: StreamEvent) => void;

const channels = new Map<string, Set<Listener>>();

export function subscribe(callId: string, listener: Listener): () => void {
  let set = channels.get(callId);
  if (!set) {
    set = new Set();
    channels.set(callId, set);
  }
  set.add(listener);
  return () => {
    set!.delete(listener);
    if (set!.size === 0) channels.delete(callId);
  };
}

export function publish(callId: string, evt: StreamEvent): void {
  channels.get(callId)?.forEach((l) => l(evt));
}
