import { isFlat } from "../stats";
import { findStepUp } from "./change-point";
import { base, ids, isActive, type Rule } from "./context";

const PRIOR_FLAT_TOL = 0.05;

// price_jump: the latest recurring charge is ≥ 1.15× the median of at least 3
// prior charges and ≥ $5 more, and the higher price is still in effect. Only
// for series whose prior charges were steady (so grocery noise never counts).
export const priceJump: Rule = (series, ctx) => {
  if (!series.recurring || !isActive(series, ctx)) return [];
  const floor = ctx.floorFor(series.merchant);
  const step = findStepUp(series.charges, floor);
  if (!step) return [];
  // Priors below an accepted amount count as that amount (it is the baseline now).
  if (!isFlat(step.priors.slice(-6).map((c) => Math.max(c.amountCents, floor)), PRIOR_FLAT_TOL)) return [];

  const latest = step.elevated[step.elevated.length - 1];
  return [
    {
      ...base(series),
      type: "price_jump",
      base: "high",
      beforeCents: step.beforeCents,
      afterCents: latest.amountCents,
      changeDate: step.elevated[0].date,
      latestDate: latest.date,
      chargesSinceChange: step.elevated.length,
      extraPaidCents: step.elevated.reduce((s, c) => s + c.amountCents - step.beforeCents, 0),
      evidence: { chargeIds: ids([...step.priors.slice(-3), ...step.elevated]), billIds: [], emailIds: [] },
      idParts: [step.elevated[0].date],
    },
  ];
};
