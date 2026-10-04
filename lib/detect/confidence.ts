import { normalizeMerchant } from "./normalize";
import { dayNumber } from "./stats";
import type { Candidate } from "./rules/context";
import type { BillEventFact, Confidence, ConfidenceReason, MerchantSeries } from "./types";

const STEP_DOWN: Record<Confidence, Confidence> = { high: "medium", medium: "low", low: "low" };
const JUMP_LIKE = new Set(["price_jump", "promo_expiry", "creeping", "outlier"]);
const YOY_MIN_DAYS = 335;
const YOY_MAX_DAYS = 395;
const YOY_SHARE = 0.5;

/**
 * The same rise happened around the same date last year: a charge 335–395 days
 * earlier was at least half as far above the baseline as this one. (Being
 * merely close to last year's amount isn't enough; a flat $120 last year must
 * not make a $138 bill look seasonal.)
 */
export function matchesLastYear(
  series: MerchantSeries,
  date: string,
  beforeCents: number,
  afterCents: number,
): boolean {
  const rise = afterCents - beforeCents;
  if (rise <= 0) return false;
  const day = dayNumber(date);
  return series.all.some(
    (c) => day - c.day >= YOY_MIN_DAYS && day - c.day <= YOY_MAX_DAYS && c.amountCents - beforeCents >= rise * YOY_SHARE,
  );
}

export function scoreConfidence(
  cand: Candidate,
  series: MerchantSeries | undefined,
  billEvents: BillEventFact[],
): { confidence: Confidence; reasons: ConfidenceReason[]; emailIds: string[] } {
  let confidence = cand.base;
  const reasons: ConfidenceReason[] = [];
  const emailIds: string[] = [];

  const events = billEvents.filter(
    (e) => e.trusted && e.provider && normalizeMerchant(e.provider).key === cand.merchant,
  );

  if (series && JUMP_LIKE.has(cand.type) && cand.beforeCents !== null) {
    // Legitimate seasonal change: last year rose the same way at this time.
    const firstElevated = series.all.find((c) => c.date === cand.changeDate);
    const before = cand.beforeCents;
    if (
      matchesLastYear(series, cand.changeDate, before, firstElevated?.amountCents ?? cand.afterCents) ||
      matchesLastYear(series, cand.latestDate, before, cand.afterCents)
    ) {
      confidence = "low";
      reasons.push("seasonal_yoy");
    }
  }

  if (series?.variable && confidence !== "low") {
    confidence = STEP_DOWN[confidence];
    reasons.push("variable_category");
  } else if (series?.variable) {
    reasons.push("variable_category");
  }

  // A verified notice confirms the change happened; it doesn't make it fine.
  const notice = events.find(
    (e) =>
      e.changeType === "price_increase" &&
      e.amountCents !== null &&
      Math.abs(e.amountCents - cand.afterCents) <= Math.max(cand.afterCents * 0.01, 1),
  );
  if (notice) {
    reasons.push("email_notice");
    emailIds.push(notice.sourceMessageId);
  }

  if (cand.type === "duplicate") {
    const receipt = events.find(
      (e) =>
        e.changeType === "receipt" &&
        e.amountCents === cand.afterCents &&
        e.effectiveDate !== null &&
        Math.abs(dayNumber(e.effectiveDate) - dayNumber(cand.changeDate)) <= 3,
    );
    if (receipt) {
      reasons.push("email_receipt");
      emailIds.push(receipt.sourceMessageId);
    }
  }

  if (cand.type === "new_recurring") reasons.push("no_email");

  return { confidence, reasons, emailIds };
}
