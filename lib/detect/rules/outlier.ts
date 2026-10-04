import { mad, median } from "../stats";
import { base, type Rule } from "./context";

const MIN_HISTORY = 6;
const RECENT_DAYS = 90;
const Z_THRESHOLD = 3.5;
const MIN_EXCESS_CENTS = 500;
const MAD_FLOOR_SHARE = 0.05; // steady bills have MAD 0; don't let a 6% wobble look extreme

// outlier: a recent charge far above the merchant's normal range, using the
// median and MAD of the charges before it. Recent outliers for one merchant
// are reported together as one finding.
export const outlier: Rule = (series, ctx) => {
  const c = series.charges;
  if (c.length < MIN_HISTORY + 1) return [];
  const floorCents = ctx.floorFor(series.merchant);
  const hits: { charge: (typeof c)[number]; med: number }[] = [];
  for (let i = MIN_HISTORY; i < c.length; i++) {
    const x = c[i];
    if (ctx.asOfDay - x.day > RECENT_DAYS) continue;
    if (floorCents && x.amountCents <= floorCents) continue;
    const priors = c.slice(Math.max(0, i - 12), i).map((p) => p.amountCents);
    // An accepted ("This is normal") amount raises the centre the charge is measured from.
    const med = Math.max(median(priors), floorCents);
    const madFloor = Math.max(Math.round(med * MAD_FLOOR_SHARE), 100);
    const z = (0.6745 * (x.amountCents - med)) / Math.max(mad(priors), madFloor);
    if (x.amountCents - med >= MIN_EXCESS_CENTS && z > Z_THRESHOLD) {
      hits.push({ charge: x, med });
    }
  }
  if (!hits.length) return [];
  const latest = hits[hits.length - 1];
  return [
    {
      ...base(series),
      type: "outlier",
      base: "medium",
      beforeCents: latest.med,
      afterCents: latest.charge.amountCents,
      changeDate: hits[0].charge.date,
      latestDate: latest.charge.date,
      chargesSinceChange: hits.length,
      extraPaidCents: hits.reduce((s, h) => s + h.charge.amountCents - h.med, 0),
      evidence: { chargeIds: hits.map((h) => h.charge.id), billIds: [], emailIds: [] },
      idParts: [hits[0].charge.date],
    },
  ];
};
