import { isFlat } from "../stats";
import { base, ids, isActive, type Rule } from "./context";

const MIN_INCREASES = 3;
const MIN_STEADY_BEFORE = 3;

// creeping: the charge went up on 3 or more consecutive cycles, ending with
// the latest one, after a steady period. Skipped for categories that vary
// legitimately (a run of rising utility bills is just the season).
export const creeping: Rule = (series, ctx) => {
  if (!series.recurring || series.variable || series.cadence !== "monthly") return [];
  if (!isActive(series, ctx)) return [];
  const c = series.charges;
  let start = c.length - 1;
  while (start > 0 && c[start - 1].amountCents < c[start].amountCents) start--;
  const run = c.slice(start);
  if (run.length - 1 < MIN_INCREASES) return [];
  const steady = c.slice(Math.max(0, start - 6), start);
  if (steady.length < MIN_STEADY_BEFORE || !isFlat(steady.map((x) => x.amountCents), 0.05)) return [];

  const floor = ctx.floorFor(series.merchant);
  const latest = run[run.length - 1];
  if (floor && latest.amountCents <= floor) return [];
  const startCents = Math.max(run[0].amountCents, floor);
  return [
    {
      ...base(series),
      type: "creeping",
      base: "medium",
      beforeCents: startCents,
      afterCents: latest.amountCents,
      changeDate: run[1].date,
      latestDate: latest.date,
      chargesSinceChange: run.length - 1,
      extraPaidCents: run.slice(1).reduce((s, x) => s + Math.max(0, x.amountCents - startCents), 0),
      evidence: { chargeIds: ids(run), billIds: [], emailIds: [] },
      idParts: [run[1].date],
    },
  ];
};
