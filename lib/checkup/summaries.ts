import type { Finding } from "@/lib/detect/types";
import { money } from "@/lib/llm/facts";
import { formatDate, type Lang } from "@/lib/llm/templates";

// One-line, plain-language summary for each finding card. Deterministic (no
// LLM), so the dashboard never waits on a model. Marked for native review.

type F = Finding;
const b = (f: F) => (f.beforeCents === null ? "" : money(f.beforeCents));
const a = (f: F) => money(f.afterCents);

const LINES: Record<Lang, Record<F["type"], (f: F, d: (x: string) => string) => string>> = {
  en: {
    price_jump: (f, d) => `Went from ${b(f)} to ${a(f)} on ${d(f.changeDate)}.`,
    promo_expiry: (f, d) => `Stayed at ${b(f)} for about a year, then rose to ${a(f)} on ${d(f.changeDate)}.`,
    duplicate: (f, d) => `Charged ${a(f)} twice within a few days (${d(f.changeDate)}).`,
    creeping: (f) => `Went up ${f.chargesSinceChange} months in a row, from ${b(f)} to ${a(f)}.`,
    new_recurring: (f, d) => `New charge of ${a(f)} since ${d(f.changeDate)}. No billing email found.`,
    outlier: (f, d) => `${a(f)} on ${d(f.latestDate)}, much higher than the usual ${b(f)}.`,
    bill_mismatch: (f, d) => `The bill said ${b(f)}, but ${a(f)} was paid on ${d(f.changeDate)}.`,
  },
  es: {
    price_jump: (f, d) => `Pasó de ${b(f)} a ${a(f)} el ${d(f.changeDate)}.`,
    promo_expiry: (f, d) => `Estuvo en ${b(f)} casi un año y subió a ${a(f)} el ${d(f.changeDate)}.`,
    duplicate: (f, d) => `Te cobró ${a(f)} dos veces en pocos días (${d(f.changeDate)}).`,
    creeping: (f) => `Subió ${f.chargesSinceChange} meses seguidos, de ${b(f)} a ${a(f)}.`,
    new_recurring: (f, d) => `Cargo nuevo de ${a(f)} desde el ${d(f.changeDate)}. No hay correo de facturación.`,
    outlier: (f, d) => `${a(f)} el ${d(f.latestDate)}, mucho más que lo habitual (${b(f)}).`,
    bill_mismatch: (f, d) => `La factura decía ${b(f)}, pero el ${d(f.changeDate)} se pagaron ${a(f)}.`,
  },
  zh: {
    price_jump: (f, d) => `${d(f.changeDate)}从 ${b(f)} 变为 ${a(f)}。`,
    promo_expiry: (f, d) => `约一年都是 ${b(f)}，${d(f.changeDate)}涨到 ${a(f)}。`,
    duplicate: (f, d) => `几天内被收取两次 ${a(f)}（${d(f.changeDate)}）。`,
    creeping: (f) => `连续 ${f.chargesSinceChange} 个月上涨，从 ${b(f)} 涨到 ${a(f)}。`,
    new_recurring: (f, d) => `自${d(f.changeDate)}起新增 ${a(f)} 的扣款，没有找到账单邮件。`,
    outlier: (f, d) => `${d(f.latestDate)}扣款 ${a(f)}，比平时的 ${b(f)} 高很多。`,
    bill_mismatch: (f, d) => `账单金额是 ${b(f)}，但${d(f.changeDate)}实际支付了 ${a(f)}。`,
  },
  ko: {
    price_jump: (f, d) => `${d(f.changeDate)}에 ${b(f)}에서 ${a(f)}(으)로 바뀌었습니다.`,
    promo_expiry: (f, d) => `약 1년간 ${b(f)}였다가 ${d(f.changeDate)}에 ${a(f)}(으)로 올랐습니다.`,
    duplicate: (f, d) => `며칠 사이에 ${a(f)}가 두 번 청구되었습니다(${d(f.changeDate)}).`,
    creeping: (f) => `${f.chargesSinceChange}개월 연속 올라 ${b(f)}에서 ${a(f)}이(가) 되었습니다.`,
    new_recurring: (f, d) => `${d(f.changeDate)}부터 ${a(f)}의 새 요금이 청구됩니다. 청구 이메일이 없습니다.`,
    outlier: (f, d) => `${d(f.latestDate)}에 ${a(f)}로, 평소 ${b(f)}보다 훨씬 높았습니다.`,
    bill_mismatch: (f, d) => `청구서는 ${b(f)}였지만 ${d(f.changeDate)}에 ${a(f)}가 결제되었습니다.`,
  },
};

// Bills that vary every month: compare the latest charge with the usual level.
const VARIABLE: Record<Lang, (f: F, d: (x: string) => string) => string> = {
  en: (f, d) => `${a(f)} on ${d(f.latestDate)}, compared with a usual ${b(f)}.`,
  es: (f, d) => `${a(f)} el ${d(f.latestDate)}, frente a lo habitual de ${b(f)}.`,
  zh: (f, d) => `${d(f.latestDate)}扣款 ${a(f)}，平时通常是 ${b(f)}。`,
  ko: (f, d) => `${d(f.latestDate)}에 ${a(f)}, 평소에는 ${b(f)}였습니다.`,
};
const STEP_TYPES = new Set(["price_jump", "promo_expiry", "creeping", "outlier"]);

export function findingSummary(f: Finding, lang: Lang): string {
  const d = (x: string) => formatDate(x, lang);
  if (f.reasons.includes("variable_category") && STEP_TYPES.has(f.type) && f.beforeCents !== null) return VARIABLE[lang](f, d);
  return LINES[lang][f.type](f, d);
}

/** What a call about this finding would be for. */
export function callKind(type: Finding["type"]): "price" | "refund" | "cancel" {
  if (type === "duplicate") return "refund";
  if (type === "new_recurring") return "cancel";
  return "price";
}

/** One line for a resolved finding: the new price and the yearly savings. */
export function resolvedSummary(lang: Lang, r: { oldCents: number; newCents: number; annualCents: number }): string {
  const o = money(r.oldCents);
  const n = money(r.newCents);
  const y = money(r.annualCents);
  switch (lang) {
    case "es":
      return `Ahora ${n} al mes en lugar de ${o}. Ahorras ${y} al año.`;
    case "zh":
      return `现在每月 ${n}，原来是 ${o}。每年节省 ${y}。`;
    case "ko":
      return `이제 월 ${n}입니다(이전 ${o}). 1년에 ${y}를 절약합니다.`;
    default:
      return `Now ${n} a month instead of ${o}. Saves ${y} a year.`;
  }
}
