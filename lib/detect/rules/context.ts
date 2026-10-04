import type { BankBill, BillEventFact, Confidence, Finding, MerchantSeries, NormalizedCharge } from "../types";

export type RuleContext = {
  asOf: string;
  asOfDay: number;
  /** Highest amount the user accepted via "This is normal" for a merchant (0 if none). */
  floorFor: (merchant: string) => number;
  dismissedMerchants: Set<string>;
  billEvents: BillEventFact[];
  bills: BankBill[];
  /** Normalized purchases by merchant, for rules that look across series. */
  seriesByMerchant: Map<string, MerchantSeries>;
};

/** A rule's output before confidence, ids and merging are applied. */
export type Candidate = Omit<Finding, "id" | "confidence" | "reasons" | "supportingRules" | "dates"> & {
  base: Confidence;
  /** Stable parts of the id (dates, not source ids, so Nessie and fixture agree). */
  idParts: string[];
};

export type Rule = (series: MerchantSeries, ctx: RuleContext) => Candidate[];

/** Series is still being charged (its latest charge is recent for its cadence). */
export function isActive(series: MerchantSeries, ctx: RuleContext): boolean {
  const last = series.charges[series.charges.length - 1];
  if (!last) return false;
  const window = series.cadence === "weekly" ? 21 : series.cadence === "annual" ? 400 : 45;
  return ctx.asOfDay - last.day <= window;
}

export function base(series: MerchantSeries) {
  return { merchant: series.merchant, display: series.display, category: series.category };
}

export const ids = (charges: NormalizedCharge[]) => charges.map((c) => c.id);
