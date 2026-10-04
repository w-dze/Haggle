"use client";

import { useEffect, useRef, useState } from "react";
import { getTranslator } from "@/lib/i18n";
import { money } from "@/lib/llm/facts";
import { formatDate, type ExplanationSections, type Lang } from "@/lib/llm/templates";
import type { FindingView } from "@/lib/dashboard";
import { Button } from "@/components/ui/button";
import { Caption } from "@/components/ui/caption";
import { ConfidenceChip } from "./chips";

type Loaded = {
  source: "llm" | "cached" | "template";
  body: ExplanationSections;
  en: ExplanationSections;
};

const CONF = { high: "conf_high", medium: "conf_medium", low: "conf_low" } as const;
const REASON = {
  seasonal_yoy: "reason_seasonal",
  variable_category: "reason_variable",
  email_notice: "reason_email_notice",
  email_receipt: "reason_email_receipt",
  no_email: "reason_no_email",
} as const;

// Finding details as a bottom sheet built on <dialog>: the browser keeps focus
// inside, Esc closes it, and the parent page's scroll is never locked (safe in
// the /demo iframe). The two actions sit in a footer that is always visible.
export function ExplainSheet({
  finding,
  lang,
  mock,
  busy,
  onClose,
  onDismiss,
  onCall,
}: {
  finding: FindingView | null;
  lang: Lang;
  mock: boolean;
  busy: boolean;
  onClose: () => void;
  onDismiss: (f: FindingView) => void;
  onCall: (f: FindingView) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState<{ status: "loading" } | { status: "error" } | { status: "ok"; data: Loaded }>({
    status: "loading",
  });
  const t = getTranslator(lang);
  const showEnglish = lang !== "en";

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (finding && !dialog.open) dialog.showModal();
    if (!finding && dialog.open) dialog.close();
  }, [finding]);

  useEffect(() => {
    if (!finding) return;
    let cancelled = false;
    setState({ status: "loading" });
    fetch(`/api/findings/${finding.id}/explain?lang=${lang}${mock ? "&mock=1" : ""}`)
      .then((r) => r.json())
      .then((json: { ok: boolean; data?: Loaded }) => {
        if (cancelled) return;
        setState(json.ok && json.data ? { status: "ok", data: json.data } : { status: "error" });
      })
      .catch(() => !cancelled && setState({ status: "error" }));
    return () => {
      cancelled = true;
    };
  }, [finding, lang, mock]);

  const Section = ({ title, items, enItems }: { title: string; items: string[]; enItems: string[] }) =>
    items.length ? (
      <section className="flex flex-col gap-2.5">
        <Caption as="h3">{title}</Caption>
        <ul className="flex flex-col gap-2.5">
          {items.map((p, i) => (
            <li key={i} className="leading-relaxed">
              <p className="text-[16px]">{p}</p>
              {showEnglish && enItems[i] && (
                <p lang="en" className="mt-0.5 text-[13px] leading-snug text-muted">
                  {enItems[i]}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>
    ) : null;

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close(); // tap on the backdrop
      }}
      aria-labelledby="explain-title"
      className="mx-auto mt-auto mb-0 w-full max-w-[440px] rounded-t-3xl border border-line bg-surface p-0 text-foreground backdrop:bg-black/40"
    >
      {finding && (
        <div className="flex max-h-[88dvh] flex-col">
          <header className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <h2 id="explain-title" className="truncate text-2xl leading-tight">
                  {finding.display}
                </h2>
                <ConfidenceChip level={finding.confidence} label={t(CONF[finding.confidence])} srLabel={t("conf_label")} />
              </div>
              <p className="font-medium leading-snug">{finding.summary}</p>
            </div>
            <button
              type="button"
              onClick={() => ref.current?.close()}
              aria-label={t("explain_close")}
              className="-mt-1 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-foreground/5 hover:text-foreground"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </header>

          <div className="flex flex-col gap-5 overflow-y-auto border-t border-line px-5 py-4">
            {finding.reasons.length > 0 && (
              <p className="text-sm text-muted">{finding.reasons.map((r) => t(REASON[r])).join(" ")}</p>
            )}
            {state.status === "loading" && (
              <p role="status" className="text-muted">
                {t("explain_loading")}
              </p>
            )}
            {state.status === "error" && (
              <p role="alert" className="text-accent">
                {t("explain_error")}
              </p>
            )}
            {state.status === "ok" && (
              <>
                <Section title={t("explain_what")} items={state.data.body.what} enItems={state.data.en.what} />
                <Section title={t("explain_causes")} items={state.data.body.causes} enItems={state.data.en.causes} />
                <Section title={t("explain_actions")} items={state.data.body.actions} enItems={state.data.en.actions} />
                <Section title={t("explain_questions")} items={state.data.body.questions} enItems={state.data.en.questions} />
              </>
            )}

            <details className="group rounded-xl border border-line">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3 text-sm font-medium">
                {t("explain_evidence")}
                <span aria-hidden="true" className="text-muted transition-transform group-open:rotate-180">
                  ▾
                </span>
              </summary>
              <div className="flex flex-col gap-3 px-3 pb-3">
                <ul className="divide-y divide-line rounded-lg border border-line text-sm">
                  {finding.evidence.charges.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <span>
                        {formatDate(c.date, lang)}
                        {c.duplicate && <span className="ml-2 text-xs text-accent">· {t("duplicate_tag")}</span>}
                      </span>
                      <span className="tabular-nums">{money(c.amountCents)}</span>
                    </li>
                  ))}
                </ul>
                {finding.evidence.email && (
                  <div>
                    <p className="mb-1.5 text-xs text-muted">{t("explain_email")}</p>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg border border-line px-3 py-2 text-sm">
                      {finding.evidence.email.newAmountCents !== null && (
                        <>
                          <dt className="text-muted">{t("explain_email_new")}</dt>
                          <dd className="tabular-nums">{money(finding.evidence.email.newAmountCents)}</dd>
                        </>
                      )}
                      {finding.evidence.email.previousAmountCents !== null && (
                        <>
                          <dt className="text-muted">{t("explain_email_prev")}</dt>
                          <dd className="tabular-nums">{money(finding.evidence.email.previousAmountCents)}</dd>
                        </>
                      )}
                      {finding.evidence.email.effectiveDate && (
                        <>
                          <dt className="text-muted">{t("explain_email_effective")}</dt>
                          <dd>{formatDate(finding.evidence.email.effectiveDate, lang)}</dd>
                        </>
                      )}
                      <dt className="text-muted">{t("explain_email_id")}</dt>
                      <dd className="truncate font-mono text-xs leading-5">{finding.evidence.email.messageId}</dd>
                    </dl>
                  </div>
                )}
              </div>
            </details>

            <p className="text-xs text-muted">
              {state.status === "ok" && state.data.source !== "llm" && (
                <>
                  {state.data.source === "cached" ? t("explain_source_cached") : t("explain_source_template")}
                  {" · "}
                </>
              )}
              {t("explain_not_advice")}
            </p>
          </div>

          <footer className="grid grid-cols-2 gap-2 border-t border-line px-5 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
            <Button variant="secondary" onClick={() => onDismiss(finding)}>
              {t("btn_normal")}
            </Button>
            {finding.confidence !== "low" ? (
              <Button variant="primary" onClick={() => onCall(finding)} disabled={busy}>
                {busy ? "…" : t("btn_call")}
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => ref.current?.close()}>
                {t("explain_close")}
              </Button>
            )}
          </footer>
        </div>
      )}
    </dialog>
  );
}
