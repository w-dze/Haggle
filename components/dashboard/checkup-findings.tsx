"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getTranslator } from "@/lib/i18n";
import { money } from "@/lib/llm/facts";
import type { Lang } from "@/lib/llm/templates";
import { mockHref } from "@/lib/mock-call";
import type { FindingView } from "@/lib/dashboard";
import { Caption } from "@/components/ui/caption";
import { StatCallout } from "@/components/ui/stat-callout";
import { ConfidenceChip } from "./chips";
import { ExplainSheet } from "./explain-sheet";

const CONF = { high: "conf_high", medium: "conf_medium", low: "conf_low" } as const;

// Summary + "01 Looks off" + "Probably fine". Cards are compact: tapping one
// opens the details sheet ("Explain this"), which holds "This is normal" and
// "Call about this". Client-side so dismissals feel instant; the server is the
// source of truth (router.refresh()). In mock mode dismissals stay local.
export function CheckupFindings({
  lang,
  mock,
  lookingOff,
  probablyFine,
  savedAnnualCents,
}: {
  lang: Lang;
  mock: boolean;
  lookingOff: FindingView[];
  probablyFine: FindingView[];
  savedAnnualCents: number;
}) {
  const t = getTranslator(lang);
  const router = useRouter();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<FindingView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<FindingView | null>(null);
  const trigger = useRef<HTMLElement | null>(null);

  // Once the server stops returning a dismissed finding, forget the local hide.
  useEffect(() => {
    const present = new Set([...lookingOff, ...probablyFine].map((f) => f.id));
    setHidden((h) => new Set([...h].filter((id) => present.has(id))));
  }, [lookingOff, probablyFine]);

  const visible = useMemo(() => lookingOff.filter((f) => !hidden.has(f.id)), [lookingOff, hidden]);
  const fine = useMemo(() => probablyFine.filter((f) => !hidden.has(f.id)), [probablyFine, hidden]);
  const extra = visible.reduce((s, f) => s + f.extraPaidCents, 0);

  const unhide = (id: string) =>
    setHidden((h) => {
      const n = new Set(h);
      n.delete(id);
      return n;
    });

  async function dismiss(f: FindingView) {
    setOpen(null);
    setError(null);
    setHidden((h) => new Set(h).add(f.id));
    setToast(f);
    if (mock) return;
    const res = await fetch(`/api/findings/${f.id}/dismiss`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lang }),
    }).catch(() => null);
    if (!res?.ok) {
      unhide(f.id);
      setToast(null);
      setError(t("action_failed"));
      return;
    }
    router.refresh();
  }

  async function undo(f: FindingView) {
    setToast(null);
    unhide(f.id);
    if (mock) return;
    const res = await fetch(`/api/findings/${f.id}/dismiss`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lang }),
    }).catch(() => null);
    if (!res?.ok) setError(t("action_failed"));
    router.refresh();
  }

  async function call(f: FindingView) {
    setError(null);
    setBusy(f.id);
    // A real case (as intake creates, even in the demo), so both the simulated
    // call and the live agent are available with this finding's numbers. In the
    // demo, fall back to the scripted case if the API is unavailable.
    try {
      const res = await fetch(`/api/findings/${f.id}/case`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lang }),
      });
      const json = (await res.json()) as { ok: boolean; data?: { case_file_id: string } };
      if (!json.ok || !json.data) throw new Error();
      router.push(`/${lang}/case/${json.data.case_file_id}?from=checkup`);
    } catch {
      if (mock) {
        const href =
          f.merchant === "northwind-internet"
            ? `/${lang}/case/demo?from=checkup`
            : `/${lang}/case/demo?from=checkup&finding=${f.id}`;
        router.push(mockHref(href, true));
        return;
      }
      setError(t("action_failed"));
      setBusy(null);
    }
  }

  function close() {
    setOpen(null);
    trigger.current?.focus({ preventScroll: true });
  }

  const card = (f: FindingView) => (
    <li key={f.id}>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={(e) => {
          trigger.current = e.currentTarget;
          setOpen(f);
        }}
        className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5 text-left hover:bg-foreground/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-semibold">{f.display}</span>
            <ConfidenceChip level={f.confidence} label={t(CONF[f.confidence])} srLabel={t("conf_label")} />
          </span>
          <span className="text-[15px] leading-snug text-muted">{f.summary}</span>
          {f.extraPaidCents > 0 && f.confidence !== "low" && (
            <span className="text-sm tabular-nums text-accent">
              +{money(f.extraPaidCents)} {t("dashboard_extra_short")}
            </span>
          )}
          {f.status === "called" && <span className="text-sm text-success">{t("dashboard_call_started")}</span>}
        </span>
        <span aria-hidden="true" className="shrink-0 text-xl text-muted">
          ›
        </span>
        <span className="sr-only">{t("btn_explain")}</span>
      </button>
    </li>
  );

  return (
    <>
      {/* Header summary (numbers from code, never the LLM). */}
      <div aria-live="polite" className="rounded-2xl border border-line bg-surface p-5">
        {visible.length ? (
          <div className="grid grid-cols-2 gap-4">
            <StatCallout value={<span className="text-[clamp(2rem,10vw,3rem)]">{visible.length}</span>} label={t("dashboard_count_label")} />
            <StatCallout
              value={<span className="whitespace-nowrap text-[clamp(1.75rem,8.5vw,3rem)]">{money(extra)}</span>}
              label={t("dashboard_extra_label")}
              className="min-w-0"
            />
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="mt-1 shrink-0 text-success" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M8 12.5l2.7 2.7L16 9.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div>
              <p className="font-display text-3xl leading-tight">{t("dashboard_all_normal_title")}</p>
              <p className="mt-1 text-muted">{t("dashboard_all_normal_body")}</p>
            </div>
          </div>
        )}
        {savedAnnualCents > 0 && (
          <p className="mt-4 border-t border-line pt-3 text-sm">
            <span className="font-semibold tabular-nums text-success">{money(savedAnnualCents)}</span>{" "}
            <span className="text-muted">{t("dashboard_saved_label")}</span>
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-accent">
          {error}
        </p>
      )}

      {visible.length > 0 && (
        <section aria-labelledby="looks-off" className="flex flex-col gap-2.5">
          <Caption as="h2" index="01" id="looks-off">
            {t("dashboard_looks_off")}
          </Caption>
          <ul className="flex flex-col gap-2">{visible.map(card)}</ul>
          <p className="text-xs text-muted">{t("dashboard_tap_hint")}</p>
        </section>
      )}

      {fine.length > 0 && (
        <details className="group rounded-2xl border border-line">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 focus-visible:outline-2 focus-visible:outline-foreground">
            <span className="font-medium">
              {t("dashboard_probably_fine")} ({fine.length})
            </span>
            <span aria-hidden="true" className="text-muted transition-transform group-open:rotate-180">
              ▾
            </span>
          </summary>
          <div className="flex flex-col gap-2 px-3 pb-3">
            <p className="px-1 text-sm text-muted">{t("dashboard_probably_fine_note")}</p>
            <ul className="flex flex-col gap-2">{fine.map(card)}</ul>
          </div>
        </details>
      )}

      {toast && (
        <div
          role="status"
          className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-2xl bg-foreground px-4 py-3 text-background shadow-lg"
        >
          <span className="text-sm">{t("dismissed_toast")}</span>
          <button
            type="button"
            onClick={() => undo(toast)}
            className="min-h-11 shrink-0 rounded-full border border-background/40 px-4 text-sm font-semibold"
          >
            {t("undo")}
          </button>
        </div>
      )}

      <ExplainSheet
        finding={open}
        lang={lang}
        mock={mock}
        busy={open ? busy === open.id : false}
        onClose={close}
        onDismiss={dismiss}
        onCall={call}
      />
    </>
  );
}
