// Deterministic generator for the bill check-up demo persona ("Maria").
// Pure: the same seed always yields the same purchases, bills and labels, so
// the committed fixture, the Nessie seed and the detector tests all agree.
// Amounts are dollars here (Nessie's unit); convert to cents at the DB boundary.

export type PersonaPurchase = {
  _id: string;
  merchant_id: string;
  description: string; // raw merchant text as it appears on a statement
  amount: number;
  purchase_date: string; // YYYY-MM-DD
  status: "completed";
  medium: "balance";
};

export type PersonaBill = {
  _id: string;
  payee: string;
  nickname: string;
  payment_amount: number;
  payment_date: string;
  status: "completed" | "pending";
};

export type PersonaMerchant = { _id: string; name: string; category: string };

// What the detector is expected to report. `not_high` marks false-alarm bait:
// it may appear only as a low-confidence finding.
export type PersonaLabel =
  | { kind: "anomaly"; type: string; merchant: string; date: string; note: string }
  | { kind: "not_high"; merchant: string; note: string };

export type PersonaData = {
  persona: { key: string; first: string; last: string; lang: string };
  asOf: string;
  merchants: PersonaMerchant[];
  purchases: PersonaPurchase[];
  bills: PersonaBill[];
  labels: PersonaLabel[];
};

/** mulberry32: tiny seeded PRNG, good enough for demo noise. */
export function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const pad = (n: number) => String(n).padStart(2, "0");

/** First day of each month, oldest first: `count` months ending with the month before `asOf`. */
export function monthsBefore(asOf: string, count: number): { y: number; m: number }[] {
  const [y0, m0] = asOf.split("-").map(Number);
  const out: { y: number; m: number }[] = [];
  for (let i = count; i >= 1; i--) {
    const idx = y0 * 12 + (m0 - 1) - i;
    out.push({ y: Math.floor(idx / 12), m: (idx % 12) + 1 });
  }
  return out;
}

export const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

export function addDays(date: string, days: number): string {
  const t = new Date(`${date}T00:00:00Z`).getTime() + days * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

const MERCHANTS: PersonaMerchant[] = [
  { _id: "m-northwind", name: "Northwind Internet", category: "home_internet" },
  { _id: "m-streamflix", name: "Streamflix", category: "streaming" },
  { _id: "m-brightly", name: "Brightly Premium", category: "subscription" },
  { _id: "m-summit", name: "Summit Health Insurance", category: "insurance" },
  { _id: "m-cascade", name: "Cascade Mobile", category: "mobile" },
  { _id: "m-harbor", name: "Harbor Wireless", category: "mobile" },
  { _id: "m-oakwood", name: "Oakwood Property Mgmt", category: "rent" },
  { _id: "m-freshmart", name: "FreshMart", category: "groceries" },
  { _id: "m-metro", name: "Metro Power & Light", category: "utility_electric" },
];

/** Summer multipliers for the electric bill: a legitimate seasonal rise every year. */
const ELECTRIC_SEASON: Record<number, number> = { 6: 1.3, 7: 1.75, 8: 1.8, 9: 1.45 };

export const MARIA_AS_OF = "2026-10-01";

export function generateMaria(seed = 20261001, asOf = MARIA_AS_OF): PersonaData {
  const rand = prng(seed);
  const purchases: PersonaPurchase[] = [];
  const bills: PersonaBill[] = [];
  let n = 0;
  const buy = (merchantId: string, description: string, date: string, amount: number) => {
    n += 1;
    purchases.push({
      _id: `p-${String(n).padStart(4, "0")}`,
      merchant_id: merchantId,
      description,
      amount: round2(amount),
      purchase_date: date,
      status: "completed",
      medium: "balance",
    });
  };
  let b = 0;
  const bill = (payee: string, nickname: string, date: string, amount: number) => {
    b += 1;
    bills.push({
      _id: `b-${String(b).padStart(4, "0")}`,
      payee,
      nickname,
      payment_amount: round2(amount),
      payment_date: date,
      status: "completed",
    });
  };

  const year = monthsBefore(asOf, 12); // Oct 2025 .. Sep 2026 for the default asOf

  year.forEach(({ y, m }, i) => {
    // Rent: flat, billed on the 1st.
    buy("m-oakwood", "OAKWOOD PROPERTY MGMT RENT", ymd(y, m, 1), 1450);
    bill("Oakwood Property Mgmt", "Rent", ymd(y, m, 1), 1450);

    // Northwind: $55 for six months, then $89 (price jump, announced by email).
    const nw = i < 6 ? 55 : 89;
    buy("m-northwind", "NORTHWIND INTERNET*AUTOPAY", ymd(y, m, 12), nw);
    bill("Northwind Internet", "Home internet", ymd(y, m, 12), nw);

    // Streamflix: flat $15.49 on the 3rd.
    buy("m-streamflix", "STREAMFLIX.COM 866-555-0110", ymd(y, m, 3), 15.49);

    // Summit Health: $120, then $138 from July (premium notice email).
    buy("m-summit", "SUMMIT HEALTH INS PREMIUM", ymd(y, m, 20), m >= 7 && y === year[11].y ? 138 : 120);

    // Cascade Mobile: $40, then a fee creeps up $1 a month over the last three cycles.
    const creep = Math.max(0, i - 8); // 0..0, then 1, 2, 3 for the last three months
    buy("m-cascade", "CASCADE MOBILE BILL PMT", ymd(y, m, 8), 40 + creep);

    // Harbor Wireless: flat.
    buy("m-harbor", "HARBOR WIRELESS", ymd(y, m, 22), 65);
    bill("Harbor Wireless", "Phone", ymd(y, m, 22), 65);
  });

  // Duplicate streaming charge within 3 days in the last month.
  const last = year[11];
  buy("m-streamflix", "STREAMFLIX.COM 866-555-0110", ymd(last.y, last.m, 5), 15.49);

  // Forgotten subscription: free trial started four months before the end, then $9.99/mo.
  for (const { y, m } of year.slice(8)) buy("m-brightly", "BRIGHTLY* PREMIUM", ymd(y, m, 17), 9.99);

  // Electricity: 24 months so the year-over-year seasonal check has a prior summer.
  for (const { y, m } of monthsBefore(asOf, 24)) {
    const base = 72 * (ELECTRIC_SEASON[m] ?? 1);
    buy("m-metro", "METRO POWER & LIGHT", ymd(y, m, 15), base + (rand() - 0.5) * 8);
  }

  // Groceries: a trip every 5–9 days, $55–$115.
  const start = ymd(year[0].y, year[0].m, 2);
  for (let d = start; d < asOf; d = addDays(d, 5 + Math.floor(rand() * 5))) {
    const store = rand() < 0.7 ? "FRESHMART #1234" : "FRESHMART 0567";
    buy("m-freshmart", store, d, 55 + rand() * 60);
  }

  purchases.sort((a, z) => a.purchase_date.localeCompare(z.purchase_date) || a._id.localeCompare(z._id));

  const jul = year.find((x) => x.m === 7)!;
  const firstJump = year[6];
  const labels: PersonaLabel[] = [
    { kind: "anomaly", type: "price_jump", merchant: "Northwind Internet", date: ymd(firstJump.y, firstJump.m, 12), note: "$55 → $89" },
    { kind: "anomaly", type: "duplicate", merchant: "Streamflix", date: ymd(last.y, last.m, 5), note: "second $15.49 within 3 days" },
    { kind: "anomaly", type: "new_recurring", merchant: "Brightly Premium", date: ymd(year[8].y, year[8].m, 17), note: "$9.99/mo after trial, no email" },
    { kind: "anomaly", type: "price_jump", merchant: "Summit Health Insurance", date: ymd(jul.y, jul.m, 20), note: "$120 → $138" },
    { kind: "anomaly", type: "creeping", merchant: "Cascade Mobile", date: ymd(last.y, last.m, 8), note: "$40 → $41 → $42 → $43" },
    { kind: "not_high", merchant: "Metro Power & Light", note: "summer rise every year (seasonal)" },
    { kind: "not_high", merchant: "FreshMart", note: "normal grocery variation" },
    { kind: "not_high", merchant: "Oakwood Property Mgmt", note: "flat rent" },
    { kind: "not_high", merchant: "Harbor Wireless", note: "flat phone bill" },
  ];

  return {
    persona: { key: "maria", first: "Maria", last: "Lopez", lang: "es" },
    asOf,
    merchants: MERCHANTS,
    purchases,
    bills,
    labels,
  };
}
