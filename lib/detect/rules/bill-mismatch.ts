import { normalizeMerchant } from "../normalize";
import { dayNumber } from "../stats";
import type { Candidate, RuleContext } from "./context";

const MATCH_WINDOW_DAYS = 3;
const MIN_DIFF_CENTS = 100;
const LOOKBACK_DAYS = 365;

// bill_mismatch: a bank bill's amount differs from the purchase that paid it.
// Runs once over all bills rather than per series.
export function billMismatch(ctx: RuleContext): Candidate[] {
  const out: Candidate[] = [];
  for (const bill of ctx.bills) {
    const day = dayNumber(bill.date);
    if (ctx.asOfDay - day > LOOKBACK_DAYS) continue;
    const { key } = normalizeMerchant(bill.payee);
    const series = ctx.seriesByMerchant.get(key);
    if (!series) continue;
    const near = series.all
      .filter((c) => Math.abs(c.day - day) <= MATCH_WINDOW_DAYS)
      .sort((a, b) => Math.abs(a.day - day) - Math.abs(b.day - day));
    const paid = near.find((c) => c.amountCents === bill.amountCents) ?? near[0];
    if (!paid || Math.abs(paid.amountCents - bill.amountCents) < MIN_DIFF_CENTS) continue;
    out.push({
      merchant: series.merchant,
      display: series.display,
      category: series.category,
      type: "bill_mismatch",
      base: "high",
      beforeCents: bill.amountCents,
      afterCents: paid.amountCents,
      changeDate: paid.date,
      latestDate: paid.date,
      chargesSinceChange: 1,
      extraPaidCents: Math.max(0, paid.amountCents - bill.amountCents),
      evidence: { chargeIds: [paid.id], billIds: [bill.id], emailIds: [] },
      idParts: [bill.date, String(bill.amountCents)],
    });
  }
  return out;
}
