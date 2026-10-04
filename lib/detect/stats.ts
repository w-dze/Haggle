// Small robust-statistics helpers. Inputs are integer cents.

export function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

/** Median absolute deviation. */
export function mad(values: number[]): number {
  const m = median(values);
  return median(values.map((v) => Math.abs(v - m)));
}

/** Robust z-score (Iglewicz & Hoaglin). `floor` stops a zero MAD exploding. */
export function robustZ(x: number, values: number[], floor: number): number {
  const m = median(values);
  const d = Math.max(mad(values), floor);
  return (0.6745 * (x - m)) / d;
}

/** True when every value is within `tol` (fraction) of the median. */
export function isFlat(values: number[], tol = 0.02): boolean {
  if (!values.length) return false;
  const m = median(values);
  return values.every((v) => Math.abs(v - m) <= Math.max(m * tol, 1));
}

export function dayNumber(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

export function monthKey(date: string): string {
  return date.slice(0, 7);
}
