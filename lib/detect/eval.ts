import { detect } from "./index";
import { normalizeMerchant } from "./normalize";
import { generateMaria, prng, monthsBefore, ymd, addDays } from "@/lib/persona/generate";
import { readDemoInbox } from "@/lib/inbox/fixture";
import { extractBillEvent } from "@/lib/inbox/extract";
import { inputFromPersona } from "./adapt";
import type { BankBill, BillEventFact, Charge, DetectInput, Finding, FindingType } from "./types";

// Detector evaluation: synthetic personas with labeled injected anomalies and
// false-alarm bait, plus Maria. Pure and seeded, so the numbers are the same
// on every run (the /eval page and scripts/eval-detector.ts both use this).
// An "alarm" is a high or medium finding; low findings are "probably fine".

export const EVAL_SEED = 4242;
export const EVAL_PERSONAS = 50;
const AS_OF = "2026-10-01";

export const INJECTED_TYPES: FindingType[] = [
  "price_jump",
  "duplicate",
  "creeping",
  "new_recurring",
  "promo_expiry",
  "outlier",
  "bill_mismatch",
];

// `subtle` marks an injection below the rule's documented threshold: missing
// it is the intended behaviour, and the report counts those misses separately.
type Label = { type: FindingType; merchant: string; subtle?: boolean };
type Bait = { name: string; merchant: string };
type Case = { name: string; input: DetectInput; labels: Label[]; baits: Bait[] };

const key = (raw: string) => normalizeMerchant(raw).key;

/**
 * One synthetic persona with two injected anomalies and the standard bait.
 * Injection sizes deliberately span the rule thresholds (e.g. 8–60% price
 * rises, 1–7 day duplicates), so some injected anomalies are expected misses.
 */
function syntheticCase(index: number): Case {
  const rand = prng(EVAL_SEED + index * 7919);
  const between = (lo: number, hi: number) => lo + rand() * (hi - lo);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const cents = (d: number) => Math.round(d * 100);

  const charges: Charge[] = [];
  const bills: BankBill[] = [];
  const billEvents: BillEventFact[] = [];
  const labels: Label[] = [];
  let n = 0;
  const add = (raw: string, date: string, dollars: number, category?: string) =>
    charges.push({ id: `c${index}-${++n}`, merchantRaw: raw, amountCents: cents(dollars), date, category });

  const year = monthsBefore(AS_OF, 12);
  const fixed = [
    { raw: "MAPLE APARTMENTS", cat: "rent", amount: Math.round(between(900, 1800)), day: 1 },
    { raw: "FIBERLINE INTERNET", cat: "home_internet", amount: Math.round(between(40, 80)), day: 9 },
    { raw: "VOXCELL WIRELESS", cat: "mobile", amount: Math.round(between(30, 70)), day: 14 },
    { raw: "BLUEPEAK INSURANCE", cat: "insurance", amount: Math.round(between(80, 200)), day: 20 },
    { raw: "IRONWORKS GYM", cat: "fitness", amount: Math.round(between(20, 50)), day: 5 },
    { raw: "VIEWBOX", cat: "streaming", amount: round2(between(8, 20)), day: 3 },
  ];
  // Per-merchant monthly amounts so injections can edit them before emitting.
  const plan = new Map(fixed.map((f) => [f.raw, year.map(() => f.amount)]));
  const extraHistory = new Map<string, number[]>(); // promo_expiry needs months before the year

  // Two distinct anomaly types, each on its own merchant.
  const types = shuffle(INJECTED_TYPES, rand).slice(0, 2);
  const targets = shuffle(fixed.filter((f) => f.amount >= 30), rand); // ≥ $30 so a 20% jump clears $5
  for (const type of types) {
    if (type === "new_recurring") {
      const raw = "SNAPAPP PLUS";
      const amount = pick([4.99, 7.99, 9.99, 14.99, 19.99]);
      const start = 12 - Math.floor(between(2, 6));
      for (const { y, m } of year.slice(start)) add(raw, ymd(y, m, 18), amount, "subscription");
      labels.push({ type, merchant: key(raw) });
      continue;
    }
    const t = targets.pop()!;
    const amounts = plan.get(t.raw)!;
    const label: Label = { type, merchant: key(t.raw) };
    labels.push(label);
    const belowJump = (up: number) => up < t.amount * 1.15 || up - t.amount < 5;
    if (type === "price_jump") {
      const k = Math.floor(between(4, 9)); // 4–8 steady months first (fewer than a promo year)
      const up = round2(t.amount * between(1.08, 1.6)); // includes subtle rises below the 15% threshold
      for (let i = k; i < 12; i++) amounts[i] = up;
      label.subtle = belowJump(up);
    } else if (type === "promo_expiry") {
      extraHistory.set(t.raw, [t.amount, t.amount, t.amount]); // 15 months: 12 flat, then 3 higher
      const up = round2(t.amount * between(1.1, 1.6));
      for (let i = 9; i < 12; i++) amounts[i] = up;
      label.subtle = belowJump(up);
    } else if (type === "creeping") {
      const d = pick([0.5, 1, 2, 3]);
      for (let j = 0; j < 3; j++) amounts[9 + j] = t.amount + d * (j + 1);
    } else if (type === "outlier") {
      amounts[pick([9, 10])] = round2(t.amount * between(1.15, 3)); // small spikes sit inside the normal range
    } else if (type === "duplicate") {
      const i = 6 + Math.floor(rand() * 6);
      const { y, m } = year[i];
      const gap = 1 + Math.floor(rand() * 7); // 6–7 days is outside the 5-day window
      add(t.raw, addDays(ymd(y, m, t.day), gap), amounts[i], t.cat);
      label.subtle = gap > 5;
    } else if (type === "bill_mismatch") {
      const i = 6 + Math.floor(rand() * 6);
      const { y, m } = year[i];
      const diff = round2(between(0.5, 20));
      bills.push({ id: `bm${index}`, payee: t.raw, amountCents: cents(amounts[i] - diff), date: ymd(y, m, t.day) });
      label.subtle = diff < 1;
    }
  }

  for (const f of fixed) {
    const before = extraHistory.get(f.raw) ?? [];
    monthsBefore(AS_OF, 12 + before.length)
      .slice(0, before.length)
      .forEach(({ y, m }, i) => add(f.raw, ymd(y, m, f.day), before[i], f.cat));
    plan.get(f.raw)!.forEach((a, i) => add(f.raw, ymd(year[i].y, year[i].m, f.day), a, f.cat));
  }
  // Matching bank bills for rent and phone (should never alarm).
  for (const raw of ["MAPLE APARTMENTS", "VOXCELL WIRELESS"]) {
    const f = fixed.find((x) => x.raw === raw)!;
    plan.get(raw)!.forEach((a, i) => {
      const date = ymd(year[i].y, year[i].m, f.day);
      if (!bills.some((b) => b.payee === raw && b.date === date)) bills.push({ id: `b${index}-${raw}-${i}`, payee: raw, amountCents: cents(a), date });
    });
  }

  // ---- False-alarm bait -------------------------------------------------------
  const baits: Bait[] = [];
  // Seasonal electricity, 24 months, summer peak of random size.
  const peak = between(1.25, 1.9);
  const season: Record<number, number> = { 6: 1 + (peak - 1) * 0.6, 7: peak, 8: peak, 9: 1 + (peak - 1) * 0.55 };
  const elecBase = between(55, 110);
  for (const { y, m } of monthsBefore(AS_OF, 24)) add("CITY ELECTRIC", ymd(y, m, 16), elecBase * (season[m] ?? 1) * between(0.95, 1.05), "utility_electric");
  baits.push({ name: "Seasonal electricity", merchant: key("CITY ELECTRIC") });
  // Water bill with ±15% month-to-month variation.
  const water = between(30, 60);
  for (const { y, m } of year) add("CITY WATER", ymd(y, m, 24), water * between(0.85, 1.15), "utility_water");
  baits.push({ name: "Variable water bill", merchant: key("CITY WATER") });
  // Groceries every 4–9 days.
  for (let d = ymd(year[0].y, year[0].m, 2); d < AS_OF; d = addDays(d, 4 + Math.floor(rand() * 6))) {
    add("GREENLEAF MARKET #88", d, between(30, 140), "groceries");
  }
  baits.push({ name: "Grocery variation", merchant: key("GREENLEAF MARKET") });
  // One-off big purchase and an annual renewal.
  add("TECHMART", addDays(AS_OF, -Math.floor(between(5, 60))), between(300, 1200), "shopping");
  baits.push({ name: "One-off large purchase", merchant: key("TECHMART") });
  add("CLOUDVAULT ANNUAL", ymd(year[4].y, year[4].m, 11), 99, "subscription");
  baits.push({ name: "Annual renewal", merchant: key("CLOUDVAULT ANNUAL") });
  // A new subscription that a verified email explains.
  if (rand() < 0.5) {
    for (const { y, m } of year.slice(9)) add("PAGETURN BOOKS", ymd(y, m, 12), 11.99, "subscription");
    billEvents.push({
      provider: "Pageturn Books",
      amountCents: 1199,
      previousAmountCents: null,
      effectiveDate: ymd(year[9].y, year[9].m, 1),
      dueDate: null,
      changeType: "statement",
      sourceMessageId: `pt-${index}`,
      trusted: true,
    });
    baits.push({ name: "New subscription with email", merchant: key("PAGETURN BOOKS") });
  }

  return { name: `synthetic-${index}`, input: { charges, bills, billEvents, dismissals: [], asOf: AS_OF }, labels, baits };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function shuffle<T>(xs: T[], rand: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function mariaCase(): Case {
  const data = generateMaria();
  const events = readDemoInbox().map((m) => extractBillEvent(m));
  const labels: Label[] = [];
  const baits: Bait[] = [];
  for (const l of data.labels) {
    if (l.kind === "anomaly") labels.push({ type: l.type as FindingType, merchant: key(l.merchant) });
    else baits.push({ name: `Maria: ${l.note}`, merchant: key(l.merchant) });
  }
  return { name: "maria", input: inputFromPersona(data, events), labels, baits };
}

export type EvalRow = {
  type: FindingType;
  injected: number;
  caught: number;
  missed: number;
  /** Misses that were below the rule's threshold by design. */
  missedSubtle: number;
  falseAlarms: number;
  precision: number | null;
  recall: number | null;
};

export type EvalReport = {
  seed: number;
  personas: number;
  rows: EvalRow[];
  total: Omit<EvalRow, "type">;
  baits: { name: string; instances: number; alarms: number; lowFindings: number }[];
  falseAlarmExamples: { persona: string; type: FindingType; merchant: string; confidence: string }[];
  missedExamples: { persona: string; type: FindingType; merchant: string; subtle: boolean }[];
};

const ratio = (a: number, b: number) => (b === 0 ? null : a / b);

export function runEval(personas = EVAL_PERSONAS, seed = EVAL_SEED): EvalReport {
  if (seed !== EVAL_SEED) throw new Error("Custom seeds are not supported; change EVAL_SEED instead.");
  const cases = [mariaCase(), ...Array.from({ length: personas }, (_, i) => syntheticCase(i + 1))];

  const caught = new Map<FindingType, number>();
  const injected = new Map<FindingType, number>();
  const falseAlarms = new Map<FindingType, number>();
  const baitStats = new Map<string, { instances: number; alarms: number; lowFindings: number }>();
  const falseAlarmExamples: EvalReport["falseAlarmExamples"] = [];
  const missedExamples: EvalReport["missedExamples"] = [];
  const missedSubtle = new Map<FindingType, number>();
  const inc = (m: Map<FindingType, number>, t: FindingType) => m.set(t, (m.get(t) ?? 0) + 1);

  for (const c of cases) {
    const findings = detect(c.input).findings;
    const alarms = findings.filter((f) => f.confidence !== "low");
    const matched = new Set<Finding>();

    for (const label of c.labels) {
      inc(injected, label.type);
      const hit = alarms.find(
        (f) => f.merchant === label.merchant && (f.type === label.type || f.supportingRules.includes(label.type)),
      );
      if (hit) {
        inc(caught, label.type);
        matched.add(hit);
      } else {
        if (label.subtle) inc(missedSubtle, label.type);
        missedExamples.push({ persona: c.name, type: label.type, merchant: label.merchant, subtle: !!label.subtle });
      }
    }
    for (const f of alarms) {
      if (matched.has(f)) continue;
      inc(falseAlarms, f.type);
      falseAlarmExamples.push({ persona: c.name, type: f.type, merchant: f.merchant, confidence: f.confidence });
    }
    for (const b of c.baits) {
      const s = baitStats.get(b.name) ?? { instances: 0, alarms: 0, lowFindings: 0 };
      s.instances += 1;
      if (alarms.some((f) => f.merchant === b.merchant)) s.alarms += 1;
      if (findings.some((f) => f.merchant === b.merchant && f.confidence === "low")) s.lowFindings += 1;
      baitStats.set(b.name, s);
    }
  }

  const rows: EvalRow[] = INJECTED_TYPES.map((type) => {
    const inj = injected.get(type) ?? 0;
    const cau = caught.get(type) ?? 0;
    const fa = falseAlarms.get(type) ?? 0;
    return {
      type,
      injected: inj,
      caught: cau,
      missed: inj - cau,
      missedSubtle: missedSubtle.get(type) ?? 0,
      falseAlarms: fa,
      precision: ratio(cau, cau + fa),
      recall: ratio(cau, inj),
    };
  });
  const sum = (k: "injected" | "caught" | "missed" | "missedSubtle" | "falseAlarms") => rows.reduce((s, r) => s + r[k], 0);
  const total = {
    injected: sum("injected"),
    caught: sum("caught"),
    missed: sum("missed"),
    missedSubtle: sum("missedSubtle"),
    falseAlarms: sum("falseAlarms"),
    precision: ratio(sum("caught"), sum("caught") + sum("falseAlarms")),
    recall: ratio(sum("caught"), sum("injected")),
  };

  return {
    seed,
    personas: cases.length,
    rows,
    total,
    baits: [...baitStats.entries()].map(([name, s]) => ({ name, ...s })),
    falseAlarmExamples,
    missedExamples,
  };
}
