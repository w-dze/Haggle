import type { BillEventFact, Charge, DetectInput } from "../types";

export const AS_OF = "2026-10-01";

/** Monthly charges ending the month before AS_OF: amounts are dollars, oldest first. */
export function monthly(raw: string, amounts: number[], opts: { day?: number; category?: string; endMonth?: string } = {}): Charge[] {
  const [ey, em] = (opts.endMonth ?? "2026-09").split("-").map(Number);
  const end = ey * 12 + (em - 1);
  return amounts.map((a, i) => {
    const idx = end - (amounts.length - 1 - i);
    const y = Math.floor(idx / 12);
    const m = (idx % 12) + 1;
    const date = `${y}-${String(m).padStart(2, "0")}-${String(opts.day ?? 10).padStart(2, "0")}`;
    return { id: `${raw}-${date}-${i}`, merchantRaw: raw, amountCents: Math.round(a * 100), date, category: opts.category };
  });
}

export const flat = (n: number, v: number) => Array.from({ length: n }, () => v);

export function input(charges: Charge[], extra: Partial<DetectInput> = {}): DetectInput {
  return { charges, bills: [], billEvents: [], dismissals: [], asOf: AS_OF, ...extra };
}

export function notice(provider: string, prev: number, next: number): BillEventFact {
  return {
    provider,
    amountCents: next * 100,
    previousAmountCents: prev * 100,
    effectiveDate: "2026-06-01",
    dueDate: null,
    changeType: "price_increase",
    sourceMessageId: `msg-${provider}`,
    trusted: true,
  };
}
