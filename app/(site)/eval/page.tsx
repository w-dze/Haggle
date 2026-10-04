import type { Metadata } from "next";
import { runEval } from "@/lib/detect/eval";

export const metadata: Metadata = { title: "Detector eval · Haggle" };
// The eval is pure and seeded, so render it once at build time.
export const dynamic = "force-static";

const LABELS: Record<string, string> = {
  price_jump: "Price jump",
  promo_expiry: "Promo ended",
  duplicate: "Duplicate charge",
  creeping: "Creeping fee",
  new_recurring: "New subscription",
  outlier: "Unusual charge",
  bill_mismatch: "Bill ≠ payment",
};

const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);

function Caption({ index, children }: { index: string; children: React.ReactNode }) {
  return (
    <h2 className="font-sans text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
      <span className="tabular-nums text-foreground">{index}</span>
      <span aria-hidden="true"> · </span>
      {children}
    </h2>
  );
}

export default function EvalPage() {
  const report = runEval();
  const t = report.total;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 md:px-8">
      <section className="py-16 md:py-20">
        <h1 className="max-w-3xl text-5xl leading-[1.02] md:text-6xl">How well does the bill check-up catch problems?</h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
          We ran the detector on {report.personas} made-up households (Maria plus {report.personas - 1} synthetic
          ones). Each synthetic household got two hidden problems and the same set of traps that should not
          raise an alarm, like a summer electricity bill.
        </p>
        <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-4">
          {[
            [`${t.caught}/${t.injected}`, "Problems caught"],
            [String(t.falseAlarms), "False alarms"],
            [pct(t.precision), "Precision"],
            [pct(t.recall), "Recall"],
          ].map(([value, label]) => (
            <div key={label} className="flex flex-col gap-2 bg-surface p-6">
              <dd className="font-display text-5xl leading-none tabular-nums">{value}</dd>
              <dt className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{label}</dt>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="by-type" className="border-t border-line py-12">
        <div id="by-type">
          <Caption index="01">By problem type</Caption>
        </div>
        <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-[640px] text-left text-sm tabular-nums">
            <thead className="text-[11px] uppercase tracking-[0.14em] text-muted">
              <tr className="border-b border-line">
                <th scope="col" className="px-4 py-3 font-medium">Type</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Hidden</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Caught</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Missed</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">False alarms</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Precision</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Recall</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((r) => (
                <tr key={r.type} className="border-b border-line last:border-0">
                  <th scope="row" className="px-4 py-3 font-normal">{LABELS[r.type] ?? r.type}</th>
                  <td className="px-4 py-3 text-right">{r.injected}</td>
                  <td className="px-4 py-3 text-right">{r.caught}</td>
                  <td className="px-4 py-3 text-right">
                    {r.missed}
                    {r.missedSubtle > 0 && (
                      <span className="text-muted"> ({r.missedSubtle} below threshold)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">{r.falseAlarms}</td>
                  <td className="px-4 py-3 text-right">{pct(r.precision)}</td>
                  <td className="px-4 py-3 text-right">{pct(r.recall)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="traps" className="border-t border-line py-12">
        <div id="traps">
          <Caption index="02">Traps that should stay quiet</Caption>
        </div>
        <ul className="mt-6 grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-2">
          {report.baits.map((b) => (
            <li key={b.name} className="flex items-baseline justify-between gap-4 bg-surface px-4 py-3 text-sm">
              <span>{b.name}</span>
              <span className="tabular-nums text-muted">
                {b.alarms === 0 ? "no alarms" : `${b.alarms} alarm${b.alarms === 1 ? "" : "s"}`} · {b.instances}{" "}
                tested{b.lowFindings ? ` · ${b.lowFindings} shown as “probably fine”` : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="method" className="border-t border-line py-12 pb-20">
        <div id="method">
          <Caption index="03">How to read this</Caption>
        </div>
        <ul className="mt-6 max-w-3xl list-disc space-y-2 pl-5 leading-relaxed text-muted">
          <li>An alarm is a High or Medium finding. Low findings are shown as “probably fine” and are not counted.</li>
          <li>
            Some hidden problems are deliberately smaller than the rules’ thresholds (for example an 8% price rise
            or a repeat charge 7 days later). Missing those is expected, and they are counted separately.
          </li>
          <li>
            The households are generated by the same team that wrote the rules, with a fixed seed ({report.seed}).
            This checks that the rules behave as designed. It is not a measure of accuracy on real bank data.
          </li>
          <li>Run it yourself with <code className="rounded bg-surface px-1">npm run eval:detector</code>.</li>
        </ul>
      </section>
    </div>
  );
}
