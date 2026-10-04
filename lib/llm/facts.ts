import competitorPlans from "@/data/competitor_plans.json";
import type { BillEventFact, Finding } from "@/lib/detect/types";
import { numbersIn } from "./validate";

// The only data an LLM ever sees about a finding: an allow-listed projection
// built by code. No email bodies, no account numbers, no free text from users
// or emails. Every number here is computed by the detector, and the validator
// only accepts explanations whose numbers come from this sheet.

export type FindingFacts = {
  type: Finding["type"];
  provider: string;
  category: string;
  confidence: Finding["confidence"];
  seasonal: boolean;
  /** The category varies month to month (utilities, groceries): describe it as a range, not a single step. */
  variable: boolean;
  before: string | null; // "$55.00"
  after: string; // "$89.00"
  difference: string | null;
  percent_change: number | null;
  change_date: string; // YYYY-MM-DD
  latest_date: string;
  charge_dates: string[];
  charges_since_change: number;
  extra_paid: string;
  /** Extracted fields from a verified provider email, if one matches. */
  email_notice: { new_amount: string | null; previous_amount: string | null; effective_date: string | null } | null;
  /** Hand-curated competitor offers (sample data, not live prices). */
  curated_offers: { provider: string; plan: string; monthly: string }[];
};

export const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

type Offer = { provider: string; plan: string; monthly: number };
const OFFERS: Record<string, Offer[]> = {
  home_internet: (competitorPlans as { home_internet?: Offer[] }).home_internet ?? [],
  mobile: (competitorPlans as { mobile?: Offer[] }).mobile ?? [],
};

export function buildFacts(finding: Finding, billEvents: BillEventFact[] = []): FindingFacts {
  const before = finding.beforeCents;
  const diff = before === null ? null : finding.afterCents - before;
  const notice = billEvents.find((e) => e.trusted && finding.evidence.emailIds.includes(e.sourceMessageId));
  const offers = (OFFERS[finding.category] ?? [])
    .filter((o) => Math.round(o.monthly * 100) < finding.afterCents)
    .slice(0, 3);
  return {
    type: finding.type,
    provider: finding.display,
    category: finding.category,
    confidence: finding.confidence,
    seasonal: finding.reasons.includes("seasonal_yoy"),
    variable: finding.reasons.includes("variable_category"),
    before: before === null ? null : money(before),
    after: money(finding.afterCents),
    difference: diff === null ? null : money(diff),
    percent_change: before ? Math.round(((finding.afterCents - before) / before) * 100) : null,
    change_date: finding.changeDate,
    latest_date: finding.latestDate,
    charge_dates: finding.dates,
    charges_since_change: finding.chargesSinceChange,
    extra_paid: money(finding.extraPaidCents),
    email_notice: notice
      ? {
          new_amount: notice.amountCents === null ? null : money(notice.amountCents),
          previous_amount: notice.previousAmountCents === null ? null : money(notice.previousAmountCents),
          effective_date: notice.effectiveDate,
        }
      : null,
    curated_offers: offers.map((o) => ({ provider: o.provider, plan: o.plan, monthly: money(Math.round(o.monthly * 100)) })),
  };
}

/** Every number an explanation is allowed to mention, as plain values. */
export function allowedNumbers(facts: FindingFacts): number[] {
  const out = new Set<number>([1, 2]); // "1 charge", "2 charges"
  const addMoney = (s: string | null) => {
    if (!s) return;
    const v = Number(s.replace(/[$,]/g, ""));
    out.add(v);
  };
  const addDate = (d: string | null) => {
    if (!d) return;
    const [y, m, day] = d.split("-").map(Number);
    out.add(y).add(m).add(day);
  };
  [facts.before, facts.after, facts.difference, facts.extra_paid].forEach(addMoney);
  if (facts.percent_change !== null) out.add(facts.percent_change);
  out.add(facts.charges_since_change);
  [facts.change_date, facts.latest_date, ...facts.charge_dates].forEach(addDate);
  if (facts.email_notice) {
    addMoney(facts.email_notice.new_amount);
    addMoney(facts.email_notice.previous_amount);
    addDate(facts.email_notice.effective_date);
  }
  for (const o of facts.curated_offers) {
    addMoney(o.monthly);
    // Names from our own data can contain digits ("500 Mbps", "5G").
    for (const n of numbersIn(`${o.provider} ${o.plan}`)) out.add(n);
  }
  for (const n of numbersIn(facts.provider)) out.add(n);
  return [...out];
}
