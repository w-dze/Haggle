"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "./button";

type Decision = "yes" | "no";

// Bottom-sheet decision card shown when the agent asks for approval (FR-22).
// Focus moves to the card itself, not to Approve, so a stray Enter can't
// accept a deal. Iframe-safe: focuses without scrolling the parent page, and
// vibration is best-effort only.
export function ApprovalCard({
  summary,
  summaryEn,
  expiresAt,
  lang,
  labels,
  onDecision,
}: {
  summary: string;
  /** English original, shown small under the translation when available. */
  summaryEn?: string;
  expiresAt: string;
  lang: string;
  labels: {
    needed: string;
    approve: string;
    decline: string;
    /** Contains "{n}" for the seconds remaining. */
    secondsLeft: string;
    sentYes: string;
    sentNo: string;
    error: string;
  };
  /** Should reject if the answer could not be sent. */
  onDecision: (decision: Decision) => Promise<void>;
}) {
  const titleId = useId();
  const summaryId = useId();
  const cardRef = useRef<HTMLElement>(null);

  const expiresMs = new Date(expiresAt).getTime();
  const [remaining, setRemaining] = useState(() => Math.max(0, expiresMs - Date.now()));
  const [total] = useState(() => Math.max(1, expiresMs - Date.now()));
  const [pending, setPending] = useState<Decision | null>(null);
  const [sent, setSent] = useState<Decision | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    cardRef.current?.focus({ preventScroll: true });
    try {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(200);
    } catch {
      // Blocked in some iframes / browsers; vibration is optional.
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setRemaining(Math.max(0, expiresMs - Date.now())), 250);
    return () => clearInterval(timer);
  }, [expiresMs]);

  async function decide(decision: Decision) {
    setPending(decision);
    setFailed(false);
    try {
      await onDecision(decision);
      setSent(decision);
    } catch {
      setFailed(true);
    } finally {
      setPending(null);
    }
  }

  const seconds = Math.ceil(remaining / 1000);
  const locked = pending !== null || sent !== null || remaining === 0;

  return (
    <section
      ref={cardRef}
      tabIndex={-1}
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={summaryId}
      className="flex-none rounded-t-3xl outline-none border-t border-line bg-surface px-4 pt-5 pb-[max(28px,env(safe-area-inset-bottom,0px))] shadow-[0_-8px_24px_rgba(0,0,0,0.08)]"
    >
      <h2
        id={titleId}
        className="flex items-center gap-2 font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-accent"
      >
        <span aria-hidden="true" className="size-2 rounded-full bg-accent" />
        {labels.needed}
      </h2>
      <div id={summaryId}>
        <p lang={lang} className="mt-2.5 font-display text-[28px] leading-[1.1]">
          {summary}
        </p>
        {summaryEn && (
          <p lang="en" className="mt-1.5 text-[13px] leading-[1.35] text-muted">
            {summaryEn}
          </p>
        )}
      </div>

      <div className="mt-4">
        <div className="h-1 overflow-hidden rounded-sm bg-line" aria-hidden="true">
          <div
            className="h-full bg-accent transition-[width] duration-200 ease-linear"
            style={{ width: `${(remaining / total) * 100}%` }}
          />
        </div>
        <p className="mt-1.5 text-right text-xs text-muted tabular-nums">
          {labels.secondsLeft.replace("{n}", String(seconds))}
        </p>
      </div>

      {sent ? (
        <p role="status" className="mt-3.5 flex min-h-14 items-center justify-center font-semibold">
          {sent === "yes" ? labels.sentYes : labels.sentNo}
        </p>
      ) : (
        <div className="mt-3.5 flex gap-3">
          <Button
            size="lg"
            variant="outline"
            className="flex-1"
            disabled={locked}
            onClick={() => decide("no")}
          >
            {labels.decline}
          </Button>
          <Button
            size="lg"
            variant="primary"
            className="flex-[1.3]"
            disabled={locked}
            onClick={() => decide("yes")}
          >
            {labels.approve}
          </Button>
        </div>
      )}

      {failed && (
        <p role="alert" className="mt-3 text-sm text-accent">
          {labels.error}
        </p>
      )}
    </section>
  );
}
