"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getTranslator, type Locale } from "@/lib/i18n";

// Screen 4 — live call: subtitles, approval modal, kill switch (§5.8, FR-19..FR-24).
// Consumes the SSE stream at /api/calls/:id/stream. The event shapes mirror
// the StreamEvent union in PDR §5.8.
type StreamEvent =
  | { type: "status"; status: "dialing" | "live" | "ended" | "failed" | "killed" }
  | { type: "line"; seq: number; speaker: "agent" | "rep"; en: string; tr: string; numbers_ok: boolean }
  | { type: "approval"; id: string; summary: string; expires_at: string }
  | { type: "approval_resolved"; id: string; status: "yes" | "no" | "timeout" }
  | { type: "outcome"; result: string; old: number; new: number }
  | { type: "debrief"; text: string };

type Line = Extract<StreamEvent, { type: "line" }>;
type Approval = Extract<StreamEvent, { type: "approval" }>;

export default function CallPage() {
  const params = useParams<{ lang: string; id: string }>();
  const lang = params.lang as Locale;
  const callId = params.id;
  const t = getTranslator(lang);
  const router = useRouter();

  const [status, setStatus] = useState<string>("dialing");
  const [lines, setLines] = useState<Line[]>([]);
  const [approval, setApproval] = useState<Approval | null>(null);
  const [showEnglish, setShowEnglish] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/calls/${callId}/simulate?lang=${lang}`, { method: "POST" }).catch(() => {
      /* playback is best-effort; SSE still shows persisted lines */
    });
    const es = new EventSource(`/api/calls/${callId}/stream`);
    es.onmessage = (e) => {
      const evt = JSON.parse(e.data) as StreamEvent;
      switch (evt.type) {
        case "status":
          setStatus(evt.status);
          break;
        case "line":
          setLines((prev) => (prev.some((x) => x.seq === evt.seq) ? prev : [...prev, evt]));
          break;
        case "approval":
          setApproval(evt);
          break;
        case "approval_resolved":
          setApproval(null);
          break;
      }
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, [callId, lang]);

  useEffect(() => {
    if (status === "ended" || status === "killed" || status === "failed") {
      const tmr = setTimeout(() => router.push(`/${lang}/debrief/${callId}`), 1600);
      return () => clearTimeout(tmr);
    }
  }, [status, lang, callId, router]);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight });
  }, [lines]);

  async function answerApproval(decision: "yes" | "no") {
    if (!approval) return;
    await fetch(`/api/approvals/${approval.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    setApproval(null);
  }

  async function endCall() {
    await fetch(`/api/calls/${callId}/end`, { method: "POST" });
  }

  const statusLabel =
    status === "live" ? t("call_live") : status === "dialing" ? t("call_dialing") : t("call_ended");

  return (
    <div className="flex flex-col gap-4 h-[80vh]">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-foreground/10 px-3 py-1 text-sm">
          {statusLabel} · {t("call_simulated")}
        </span>
        <button onClick={() => setShowEnglish((v) => !v)} className="text-sm underline text-muted">
          {t("call_show_english")}
        </button>
      </div>

      <div ref={feedRef} className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1">
        {lines.map((l) => (
          <div key={l.seq} className="flex flex-col gap-1">
            <span className="text-xs text-muted">
              {l.speaker === "agent" ? `🤖 ${t("speaker_agent")}` : `👤 ${t("speaker_rep")}`}
            </span>
            <p className={`subtitle-line ${l.numbers_ok ? "" : "text-danger"}`}>
              {l.numbers_ok ? l.tr : `⚠️ ${l.tr}`}
            </p>
            {showEnglish && <p className="text-sm text-muted">{l.en}</p>}
          </div>
        ))}
      </div>

      <button onClick={endCall} className="btn-reject bg-danger/20 text-danger border border-danger/30">
        {t("call_end")}
      </button>

      {approval && (
        <div className="fixed inset-0 bg-black/60 grid place-items-center p-4">
          <div className="bg-background border border-foreground/20 rounded-2xl p-6 w-full max-w-sm flex flex-col gap-4">
            <p className="text-lg">{approval.summary}</p>
            <div className="flex gap-3">
              <button onClick={() => answerApproval("yes")} className="btn-approve bg-accent text-background flex-1">
                {t("approval_yes")}
              </button>
              <button onClick={() => answerApproval("no")} className="btn-reject bg-danger/20 text-danger flex-1">
                {t("approval_no")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
