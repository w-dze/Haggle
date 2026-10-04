import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { detect } from "../index";
import { flat, input, monthly, notice } from "./helpers";

const types = (r: ReturnType<typeof detect>) => r.findings.map((f) => `${f.type}:${f.confidence}`);

describe("price_jump", () => {
  test("exactly 1.15× and ≥ $5 is flagged (≥, not >)", () => {
    const r = detect(input(monthly("ACME INSURANCE", [...flat(9, 120), 138, 138, 138])));
    assert.deepEqual(types(r), ["price_jump:high"]);
    const f = r.findings[0];
    assert.equal(f.beforeCents, 12000);
    assert.equal(f.afterCents, 13800);
    assert.equal(f.extraPaidCents, 3 * 1800);
    assert.equal(f.changeDate, "2026-07-10");
  });

  test("1.14× is not flagged", () => {
    assert.deepEqual(types(detect(input(monthly("ACME", [...flat(9, 100), 114, 114, 114])))), []);
  });

  test("a big ratio under $5 is not flagged", () => {
    assert.deepEqual(types(detect(input(monthly("TINY APP", [...flat(9, 4), 8, 8, 8])))), []);
  });

  test("needs at least 3 prior charges", () => {
    const r = detect(input(monthly("OLDCO", [50, 50, 80], { endMonth: "2026-03" })));
    assert.ok(!types(r).some((t) => t.startsWith("price_jump")));
  });

  test("a jump on the latest charge alone is flagged", () => {
    assert.deepEqual(types(detect(input(monthly("ACME", [...flat(7, 60), 80])))), ["price_jump:high"]);
  });

  test("a spike that went back to normal is an outlier, not a price jump", () => {
    const r = detect(input(monthly("ACME", [...flat(9, 60), 150, 60, 60])));
    assert.deepEqual(types(r), ["outlier:medium"]);
  });

  test("matching verified notice is attached as evidence", () => {
    const r = detect(input(monthly("ACME INSURANCE", [...flat(9, 120), 138, 138, 138]), { billEvents: [notice("Acme Insurance", 120, 138)] }));
    assert.deepEqual(r.findings[0].reasons, ["email_notice"]);
    assert.deepEqual(r.findings[0].evidence.emailIds, ["msg-Acme Insurance"]);
  });
});

describe("promo_expiry", () => {
  test("about 12 flat months then a step is promo_expiry (price_jump supporting)", () => {
    const r = detect(input(monthly("PROMO NET", [...flat(12, 40), 65, 65], { endMonth: "2026-09" })));
    assert.deepEqual(types(r), ["promo_expiry:high"]);
    assert.ok(r.findings[0].supportingRules.includes("price_jump"));
  });

  test("six flat months then a step is a plain price_jump", () => {
    const r = detect(input(monthly("SHORT NET", [...flat(6, 55), ...flat(6, 89)])));
    assert.deepEqual(types(r), ["price_jump:high"]);
  });
});

describe("duplicate", () => {
  test("same amount within 5 days", () => {
    const charges = [...monthly("STREAMCO", flat(12, 15.49), { day: 3 })];
    charges.push({ id: "dup", merchantRaw: "STREAMCO", amountCents: 1549, date: "2026-09-07" });
    const r = detect(input(charges));
    assert.deepEqual(types(r), ["duplicate:high"]);
    assert.equal(r.findings[0].extraPaidCents, 1549);
  });

  test("6 days apart is not a duplicate", () => {
    const charges = [...monthly("STREAMCO", flat(12, 15.49), { day: 3 })];
    charges.push({ id: "dup", merchantRaw: "STREAMCO", amountCents: 1549, date: "2026-09-09" });
    assert.ok(!types(detect(input(charges))).some((t) => t.startsWith("duplicate")));
  });

  test("different amount within 5 days is not a duplicate", () => {
    const charges = [...monthly("STREAMCO", flat(12, 15.49), { day: 3 })];
    charges.push({ id: "x", merchantRaw: "STREAMCO", amountCents: 1599, date: "2026-09-05" });
    assert.ok(!types(detect(input(charges))).some((t) => t.startsWith("duplicate")));
  });
});

describe("creeping", () => {
  test("three consecutive increases after a steady period", () => {
    const r = detect(input(monthly("CELLCO", [...flat(8, 40), 40, 41, 42, 43])));
    assert.deepEqual(types(r), ["creeping:medium"]);
    assert.equal(r.findings[0].extraPaidCents, 600);
  });

  test("two increases are not enough", () => {
    assert.deepEqual(types(detect(input(monthly("CELLCO", [...flat(9, 40), 40, 41, 42])))), []);
  });

  test("skipped for categories that vary legitimately", () => {
    const r = detect(input(monthly("CITY WATER", [...flat(8, 40), 40, 41, 42, 43], { category: "utility_water" })));
    assert.ok(!types(r).some((t) => t.startsWith("creeping")));
  });
});

describe("new_recurring", () => {
  test("a new monthly charge with no email", () => {
    const r = detect(input(monthly("SHINYAPP", flat(3, 9.99))));
    assert.deepEqual(types(r), ["new_recurring:medium"]);
    assert.equal(r.findings[0].extraPaidCents, 2997);
  });

  test("not flagged when a verified email from that provider exists", () => {
    const ev = { ...notice("Shinyapp", 0, 9.99), changeType: "receipt", amountCents: 999 };
    assert.deepEqual(types(detect(input(monthly("SHINYAPP", flat(3, 9.99)), { billEvents: [ev] }))), []);
  });

  test("an untrusted email does not explain it", () => {
    const ev = { ...notice("Shinyapp", 0, 9.99), trusted: false };
    assert.deepEqual(types(detect(input(monthly("SHINYAPP", flat(3, 9.99)), { billEvents: [ev] }))), ["new_recurring:medium"]);
  });

  test("older than six months is not new", () => {
    assert.deepEqual(types(detect(input(monthly("SHINYAPP", flat(8, 9.99))))), []);
  });
});

describe("outlier", () => {
  test("a spike older than 90 days is ignored", () => {
    assert.deepEqual(types(detect(input(monthly("ACME", [...flat(5, 60), 150, ...flat(6, 60)])))), []);
  });

  test("normal grocery variation never alarms", () => {
    const amounts = [62, 88, 71, 104, 55, 97, 80, 66, 112, 74, 91, 59, 101, 68, 85];
    const charges = amounts.map((a, i) => ({
      id: `g${i}`,
      merchantRaw: "FRESHMART #1234",
      amountCents: a * 100,
      date: `2026-${String(7 + Math.floor(i / 5)).padStart(2, "0")}-${String(1 + (i % 5) * 6).padStart(2, "0")}`,
    }));
    assert.deepEqual(types(detect(input(charges))), []);
  });
});

describe("bill_mismatch", () => {
  test("bill amount differs from the purchase that paid it", () => {
    const charges = monthly("HARBOR WIRELESS", flat(12, 65), { day: 22 });
    charges[11].amountCents = 7200;
    const bills = [{ id: "b1", payee: "Harbor Wireless", amountCents: 6500, date: "2026-09-22" }];
    const r = detect(input(charges, { bills }));
    assert.equal(r.findings[0].type, "bill_mismatch");
    assert.equal(r.findings[0].extraPaidCents, 700);
    assert.deepEqual(r.findings[0].evidence.billIds, ["b1"]);
  });

  test("matching bill and purchase is fine", () => {
    const charges = monthly("HARBOR WIRELESS", flat(12, 65), { day: 22 });
    const bills = [{ id: "b1", payee: "Harbor Wireless", amountCents: 6500, date: "2026-09-22" }];
    assert.deepEqual(types(detect(input(charges, { bills }))), []);
  });
});

describe("confidence", () => {
  test("a summer rise that also happened last year is low confidence", () => {
    const season: Record<number, number> = { 6: 1.3, 7: 1.75, 8: 1.8, 9: 1.45 };
    const amounts = Array.from({ length: 24 }, (_, i) => 72 * (season[((9 + i) % 12) + 1] ?? 1));
    const r = detect(input(monthly("METRO POWER & LIGHT", amounts, { day: 15 })));
    assert.ok(r.findings.length > 0);
    assert.ok(r.findings.every((f) => f.confidence === "low"), JSON.stringify(types(r)));
    assert.ok(r.findings[0].reasons.includes("seasonal_yoy"));
  });

  test("a flat bill last year does not make this year's rise seasonal", () => {
    const r = detect(input(monthly("ACME", [...flat(9, 120), 138, 138, 138])));
    assert.ok(!r.findings[0].reasons.includes("seasonal_yoy"));
  });

  test("variable categories are stepped down one level", () => {
    const r = detect(input(monthly("CITY GAS", [...flat(7, 60), 80], { category: "utility_gas" })));
    assert.deepEqual(types(r), ["price_jump:medium"]);
    assert.ok(r.findings[0].reasons.includes("variable_category"));
  });
});

describe("dismissals", () => {
  const charges = monthly("SHORT NET", [...flat(6, 55), ...flat(6, 89)]);

  test("dismissed finding id never returns, and the amount becomes the baseline", () => {
    const first = detect(input(charges)).findings[0];
    const dismissals = [{ findingId: first.id, merchant: first.merchant, acceptedAmountCents: 8900 }];
    assert.deepEqual(types(detect(input(charges, { dismissals }))), []);
  });

  test("a small rise above the accepted amount stays quiet; a big one is flagged", () => {
    const first = detect(input(charges)).findings[0];
    const dismissals = [{ findingId: first.id, merchant: first.merchant, acceptedAmountCents: 8900 }];
    const small = monthly("SHORT NET", [...flat(6, 55), ...flat(5, 89), 94]);
    assert.deepEqual(types(detect(input(small, { dismissals }))), []);
    const big = monthly("SHORT NET", [...flat(6, 55), ...flat(5, 89), 109]);
    assert.deepEqual(types(detect(input(big, { dismissals }))), ["price_jump:high"]);
  });
});

describe("ids", () => {
  test("finding ids depend on dates, not source ids (Nessie and fixture agree)", () => {
    const a = monthly("SHORT NET", [...flat(6, 55), ...flat(6, 89)]);
    const b = a.map((c, i) => ({ ...c, id: `nessie-${i}` }));
    assert.equal(detect(input(a)).findings[0].id, detect(input(b)).findings[0].id);
  });
});
