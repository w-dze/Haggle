import { dismissalBaselines } from "./baseline";
import { scoreConfidence } from "./confidence";
import { groupSeries, normalizeCharges } from "./group";
import { stableId } from "./hash";
import { billMismatch } from "./rules/bill-mismatch";
import type { Candidate, Rule, RuleContext } from "./rules/context";
import { creeping } from "./rules/creeping";
import { duplicate } from "./rules/duplicate";
import { newRecurring } from "./rules/new-recurring";
import { outlier } from "./rules/outlier";
import { priceJump } from "./rules/price-jump";
import { promoExpiry } from "./rules/promo-expiry";
import { dayNumber, median, monthKey } from "./stats";
import type {
  DetectInput,
  DetectResult,
  Finding,
  FindingType,
  MerchantSeries,
  MerchantSummary,
} from "./types";

export type * from "./types";

const RULES: Rule[] = [promoExpiry, priceJump, creeping, outlier, duplicate, newRecurring];

// When several rules describe the same charges, keep one finding (the most
// specific) and list the others as supporting rules.
const PRIORITY: FindingType[] = [
  "promo_expiry",
  "price_jump",
  "creeping",
  "bill_mismatch",
  "duplicate",
  "new_recurring",
  "outlier",
];
const JUMP_LIKE = new Set<FindingType>(["promo_expiry", "price_jump", "creeping", "outlier"]);

function overlaps(a: Candidate, b: Candidate): boolean {
  if (a.merchant !== b.merchant) return false;
  if (JUMP_LIKE.has(a.type) && JUMP_LIKE.has(b.type)) return true;
  return a.evidence.chargeIds.some((id) => b.evidence.chargeIds.includes(id));
}

function mergeCandidates(cands: Candidate[]): { kept: Candidate; supporting: FindingType[] }[] {
  const sorted = [...cands].sort((a, b) => PRIORITY.indexOf(a.type) - PRIORITY.indexOf(b.type));
  const out: { kept: Candidate; supporting: FindingType[] }[] = [];
  for (const c of sorted) {
    const host = out.find((o) => overlaps(o.kept, c));
    if (host) {
      if (!host.supporting.includes(c.type) && c.type !== host.kept.type) host.supporting.push(c.type);
    } else {
      out.push({ kept: c, supporting: [] });
    }
  }
  return out;
}

const CONF_ORDER = { high: 0, medium: 1, low: 2 } as const;

function monthsBefore(asOf: string, count: number): string[] {
  const [y, m] = asOf.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const idx = y * 12 + (m - 1) - (count - i);
    return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
  });
}

function summarize(series: MerchantSeries, findings: Finding[], asOf: string): MerchantSummary {
  // Typical = the current level: the last 3 charges for steady bills, a longer
  // window for bills that vary month to month (utilities, groceries).
  const recent = series.charges.slice(series.variable ? -12 : -3).map((c) => c.amountCents);
  const last = series.all[series.all.length - 1];
  const months = monthsBefore(asOf, 12);
  const totals = new Map(months.map((m) => [m, 0]));
  for (const c of series.all) {
    const k = monthKey(c.date);
    if (totals.has(k)) totals.set(k, totals.get(k)! + c.amountCents);
  }
  const mine = findings.filter((f) => f.merchant === series.merchant && f.confidence !== "low");
  const status = mine.some((f) => f.type === "new_recurring")
    ? "new"
    : mine.length
      ? "changed"
      : "normal";
  return {
    merchant: series.merchant,
    display: series.display,
    category: series.category,
    cadence: series.cadence,
    typicalCents: median(recent),
    lastDate: last.date,
    lastCents: last.amountCents,
    monthly: months.map((m) => ({ month: m, cents: totals.get(m)! })),
    status,
    chargeIds: series.all.map((c) => c.id),
  };
}

/** Run every rule. Pure and deterministic: same input, same output. */
export function detect(input: DetectInput): DetectResult {
  const charges = normalizeCharges(input.charges);
  const series = groupSeries(charges);
  const seriesByMerchant = new Map(series.map((s) => [s.merchant, s]));
  const { floorFor, dismissedIds, dismissedMerchants } = dismissalBaselines(input.dismissals);

  const ctx: RuleContext = {
    asOf: input.asOf,
    asOfDay: dayNumber(input.asOf),
    floorFor,
    dismissedMerchants,
    billEvents: input.billEvents,
    bills: input.bills,
    seriesByMerchant,
  };

  const dateById = new Map(charges.map((c) => [c.id, c.date]));
  const candidates = [...series.flatMap((s) => RULES.flatMap((rule) => rule(s, ctx))), ...billMismatch(ctx)];

  const findings: Finding[] = mergeCandidates(candidates)
    .map(({ kept, supporting }) => {
      const s = seriesByMerchant.get(kept.merchant);
      const { confidence, reasons, emailIds } = scoreConfidence(kept, s, input.billEvents);
      const { base: _base, idParts, ...rest } = kept;
      return {
        ...rest,
        id: stableId(kept.type, kept.merchant, ...idParts),
        confidence,
        reasons,
        supportingRules: supporting,
        dates: [...new Set(rest.evidence.chargeIds.map((id) => dateById.get(id)!).filter(Boolean))].sort(),
        evidence: { ...rest.evidence, emailIds: [...new Set([...rest.evidence.emailIds, ...emailIds])] },
      };
    })
    .filter((f) => !dismissedIds.has(f.id))
    .sort(
      (a, b) =>
        CONF_ORDER[a.confidence] - CONF_ORDER[b.confidence] ||
        b.extraPaidCents - a.extraPaidCents ||
        a.id.localeCompare(b.id),
    );

  const merchants = series
    .filter((s) => s.cadence !== "irregular" && s.charges.length >= 2)
    .map((s) => summarize(s, findings, input.asOf))
    .sort((a, b) => b.typicalCents - a.typicalCents || a.display.localeCompare(b.display));

  return { asOf: input.asOf, merchants, findings };
}

/** Header numbers: only open high/medium findings count, so the total never overclaims. */
export function summarizeFindings(findings: Finding[]) {
  const counted = findings.filter((f) => f.confidence !== "low");
  return {
    count: counted.length,
    extraPaidCents: counted.reduce((s, f) => s + f.extraPaidCents, 0),
    lowCount: findings.length - counted.length,
  };
}
