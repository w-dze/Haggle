/** Convert a dollar amount to integer cents. */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/** Convert integer cents to dollars. */
export function centsToDollars(cents: number): number {
  return cents / 100;
}

export function formatMoney(cents: number, locale = "en"): string {
  return new Intl.NumberFormat(locale === "zh" ? "zh-CN" : locale === "ko" ? "ko-KR" : locale, {
    style: "currency",
    currency: "USD",
  }).format(centsToDollars(cents));
}

/** Best-effort YYYY-MM-DD from an OCR date string. */
export function asDateOnly(value?: string): string | null {
  if (!value) return null;
  const m = value.match(/\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : null;
}
