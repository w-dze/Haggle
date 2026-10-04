import { isFlat, median } from "../stats";
import { findStepUp } from "./change-point";
import { base, ids, isActive, type Rule } from "./context";

const MIN_FLAT_CHARGES = 10;
const MIN_FLAT_SPAN_DAYS = 270; // "about 12 months" of monthly charges
const FLAT_TOL = 0.02;

// promo_expiry: a price that held flat for about a year, then stepped up.
export const promoExpiry: Rule = (series, ctx) => {
  if (!series.recurring || !isActive(series, ctx)) return [];
  const step = findStepUp(series.charges, ctx.floorFor(series.merchant));
  if (!step) return [];

  // The flat run immediately before the step.
  const before = median(step.priors.slice(-3).map((c) => c.amountCents));
  const flat = [];
  for (let i = step.priors.length - 1; i >= 0; i--) {
    if (Math.abs(step.priors[i].amountCents - before) > Math.max(before * FLAT_TOL, 1)) break;
    flat.unshift(step.priors[i]);
  }
  if (flat.length < MIN_FLAT_CHARGES) return [];
  if (flat[flat.length - 1].day - flat[0].day < MIN_FLAT_SPAN_DAYS) return [];
  if (!isFlat(flat.map((c) => c.amountCents), FLAT_TOL)) return [];

  const latest = step.elevated[step.elevated.length - 1];
  return [
    {
      ...base(series),
      type: "promo_expiry",
      base: "high",
      beforeCents: before,
      afterCents: latest.amountCents,
      changeDate: step.elevated[0].date,
      latestDate: latest.date,
      chargesSinceChange: step.elevated.length,
      extraPaidCents: step.elevated.reduce((s, c) => s + c.amountCents - before, 0),
      evidence: { chargeIds: ids([...flat.slice(-3), ...step.elevated]), billIds: [], emailIds: [] },
      idParts: [step.elevated[0].date],
    },
  ];
};
