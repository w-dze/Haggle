import { DUPLICATE_WINDOW_DAYS } from "../group";
import { base, type Rule } from "./context";

const LOOKBACK_DAYS = 365;

// duplicate: same merchant and same amount within 5 days.
export const duplicate: Rule = (series, ctx) =>
  series.duplicateIds.flatMap((dupId) => {
    const dup = series.all.find((c) => c.id === dupId)!;
    if (ctx.asOfDay - dup.day > LOOKBACK_DAYS) return [];
    const twin = series.charges.find(
      (c) => c.amountCents === dup.amountCents && dup.day - c.day >= 0 && dup.day - c.day <= DUPLICATE_WINDOW_DAYS,
    );
    if (!twin) return [];
    return [
      {
        ...base(series),
        type: "duplicate" as const,
        base: "high" as const,
        beforeCents: twin.amountCents,
        afterCents: dup.amountCents,
        changeDate: dup.date,
        latestDate: dup.date,
        chargesSinceChange: 1,
        extraPaidCents: dup.amountCents,
        evidence: { chargeIds: [twin.id, dup.id], billIds: [], emailIds: [] },
        idParts: [twin.date, dup.date, String(dup.amountCents)],
      },
    ];
  });
