import { normalizeMerchant } from "../normalize";
import { isFlat } from "../stats";
import { base, ids, isActive, type Rule } from "./context";

const NEW_WITHIN_DAYS = 183;
const MIN_CHARGES = 2;

// new_recurring: a merchant that started charging regularly in the last six
// months, with no billing email from a verified sender to explain it.
export const newRecurring: Rule = (series, ctx) => {
  const c = series.charges;
  if (c.length < MIN_CHARGES) return [];
  if (series.cadence !== "monthly" && series.cadence !== "weekly") return [];
  if (ctx.asOfDay - c[0].day > NEW_WITHIN_DAYS) return [];
  if (!isActive(series, ctx) || !isFlat(c.map((x) => x.amountCents), 0.05)) return [];
  if (ctx.dismissedMerchants.has(series.merchant)) return [];
  const explained = ctx.billEvents.some(
    (e) => e.trusted && e.provider && normalizeMerchant(e.provider).key === series.merchant,
  );
  if (explained) return [];

  const latest = c[c.length - 1];
  return [
    {
      ...base(series),
      type: "new_recurring",
      base: "medium",
      beforeCents: null,
      afterCents: latest.amountCents,
      changeDate: c[0].date,
      latestDate: latest.date,
      chargesSinceChange: c.length,
      extraPaidCents: c.reduce((s, x) => s + x.amountCents, 0),
      evidence: { chargeIds: ids(c), billIds: [], emailIds: [] },
      idParts: [c[0].date],
    },
  ];
};
