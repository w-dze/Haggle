"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { getTranslator } from "@/lib/i18n";
import { mockHref } from "@/lib/mock-call";
import { isTerminal, useCallStream } from "@/components/app/use-call-stream";
import { ApprovalCard } from "@/components/ui/approval-card";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { TranscriptLine } from "@/components/ui/transcript-line";

// Screen 4 — live call: subtitles, approval card, kill switch (§5.8, FR-19..FR-24).
// Consumes /api/calls/:id/stream, or the scripted demo call with ?mock=1.

const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

function clock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export default function CallPage() {
  const params = useParams<{ lang: string; id: string }>();
  const mock = useSearchParams().get("mock") === "1";
  const { lang, id: callId } = params;
  const t = getTranslator(lang);
  const tEn = getTranslator("en");

  const call = useCallStream(callId, lang, mock);
  const [showEnglish, setShowEnglish] = useState(true);
  // English UI: the "translation" is the English itself, so show it once.
  const english = showEnglish && lang !== "en";
  const ended = isTerminal(call.status);
  const waiting = call.status === "dialing" && call.items.length === 0;

  // Elapsed timer from the moment the call goes live.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (call.liveAt === null || call.endedAt !== null) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [call.liveAt, call.endedAt]);
  const elapsed = call.liveAt === null ? 0 : (call.endedAt ?? now) - call.liveAt;

  // Follow new lines only while the user is at the bottom, so scrolling back
  // to re-read isn't interrupted. Scrolls the feed element itself (iframe-safe).
  // A ResizeObserver fires after layout, so it also catches the feed resizing
  // when the approval card opens or closes.
  const feedRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  useEffect(() => {
    const feed = feedRef.current;
    const content = contentRef.current;
    if (!feed || !content) return;
    const follow = () => {
      if (stickRef.current) feed.scrollTop = feed.scrollHeight;
    };
    const observer = new ResizeObserver(follow);
    observer.observe(feed);
    observer.observe(content);
    return () => observer.disconnect();
  }, [waiting]);

  const lastLineIndex = call.items.reduce((last, item, i) => (item.kind === "line" ? i : last), -1);
  const statusLabel =
    call.status === "live"
      ? t("call_live")
      : call.status === "dialing"
        ? t("call_dialing")
        : t("call_ended");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-none items-center justify-between px-4 pt-2 pb-1">
        <div className="flex items-center gap-2.5">
          <StatusPill status={call.status} label={statusLabel} />
          <span className="text-sm text-muted tabular-nums">{clock(elapsed)}</span>
          {!call.connected && !ended && (
            <span className="text-xs text-muted">{t("call_reconnecting")}</span>
          )}
        </div>
        {lang !== "en" && (
          <button
            type="button"
            aria-pressed={!showEnglish}
            onClick={() => setShowEnglish((v) => !v)}
            className="h-11 rounded-full border border-line px-3.5 text-xs font-medium hover:bg-foreground/5"
          >
            {showEnglish ? t("call_hide_english") : t("call_show_english")}
          </button>
        )}
      </div>

      {waiting ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-8 text-center">
          <div className="relative flex size-44 items-center justify-center">
            {/* Only the outer ring breathes, so the graphic still reads as "in progress". */}
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-full border border-line motion-safe:animate-pulse"
            />
            <div className="flex size-[124px] items-center justify-center rounded-full border border-foreground/25">
              <div className="flex size-[72px] items-center justify-center rounded-full bg-agent">
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
                </svg>
              </div>
            </div>
          </div>
          <div>
            <h1 className="text-4xl leading-[1.1]">{t("call_dialing")}…</h1>
            <p className="mt-3 text-base leading-[1.4]">{t("call_waiting_hint")}</p>
            {english && (
              <p lang="en" className="mt-1.5 text-[13px] leading-[1.35] text-muted">
                {tEn("call_waiting_hint")}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div
          ref={feedRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          }}
          aria-live="polite"
          className="min-h-0 flex-1 overflow-y-auto px-4 pt-2 pb-4 [overflow-anchor:none]"
        >
          <div ref={contentRef} className="flex min-h-full flex-col justify-end gap-3">
            {call.items.map((item, i) =>
              item.kind === "line" ? (
                <TranscriptLine
                  key={`line-${item.line.seq}`}
                  line={item.line}
                  lang={lang}
                  showEnglish={english}
                  past={i < lastLineIndex}
                  labels={{
                    agent: t("speaker_agent"),
                    rep: t("speaker_rep"),
                    numberCheck: t("number_check"),
                  }}
                />
              ) : (
                <p key={`notice-${item.id}`} className="self-center text-xs text-muted">
                  {t("approval_timeout")}
                </p>
              ),
            )}

            {ended && call.outcome && (
              <div className="rounded-2xl border border-line bg-surface px-5 pt-5 pb-[22px]">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
                  {t("call_outcome")}
                </p>
                <p className="mt-2.5 flex items-baseline gap-3 font-display leading-none">
                  <span className="text-4xl text-muted line-through">{money(call.outcome.old)}</span>
                  <span className="text-2xl text-muted" aria-hidden="true">
                    →
                  </span>
                  <span className="text-[64px]">{money(call.outcome.new)}</span>
                </p>
                <p className="mt-2 text-sm text-muted">{t("per_month")}</p>
              </div>
            )}

            {(call.status === "failed" || call.status === "killed") && (
              <p className="self-center text-sm text-muted">
                {call.status === "failed" ? t("call_failed") : t("call_killed")}
              </p>
            )}
          </div>
        </div>
      )}

      {call.approval && !ended ? (
        <ApprovalCard
          key={call.approval.id}
          summary={call.approval.summary}
          summaryEn={english ? call.approval.summary_en : undefined}
          expiresAt={call.approval.expires_at}
          lang={lang}
          onDecision={call.answer}
          labels={{
            needed: t("approval_needed"),
            approve: t("approval_yes"),
            decline: t("approval_no"),
            secondsLeft: t("approval_seconds_left"),
            sentYes: t("approval_sent_yes"),
            sentNo: t("approval_sent_no"),
            error: t("approval_error"),
          }}
        />
      ) : (
        <footer className="flex-none border-t border-line bg-background px-4 pt-3 pb-[max(28px,env(safe-area-inset-bottom,0px))]">
          {ended ? (
            <Button
              href={mockHref(`/${lang}/debrief/${callId}`, mock)}
              size="lg"
              className="w-full"
            >
              {t("call_see_results")}
            </Button>
          ) : (
            <Button size="lg" variant="danger" className="w-full" onClick={call.end}>
              {t("call_end")}
            </Button>
          )}
        </footer>
      )}
    </div>
  );
}
