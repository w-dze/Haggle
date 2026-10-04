import { test } from "node:test";
import assert from "node:assert/strict";
import { detect, summarizeFindings } from "../index";
import { inputFromPersona } from "../adapt";
import { generateMaria } from "@/lib/persona/generate";
import { readDemoInbox } from "@/lib/inbox/fixture";
import { extractBillEvent } from "@/lib/inbox/extract";
import fixture from "@/data/fixtures/maria.json";

const events = readDemoInbox().map((m) => extractBillEvent(m));
const result = detect(inputFromPersona(generateMaria(), events));
const by = (display: string) => result.findings.filter((f) => f.display === display);

test("committed fixture matches the generator", () => {
  assert.deepEqual(fixture, JSON.parse(JSON.stringify(generateMaria())));
});

test("Northwind $55 → $89: high price jump, notice attached, $204 extra", () => {
  const [f] = by("Northwind Internet");
  assert.equal(f.type, "price_jump");
  assert.equal(f.confidence, "high");
  assert.equal(f.beforeCents, 5500);
  assert.equal(f.afterCents, 8900);
  assert.equal(f.extraPaidCents, 20400);
  assert.deepEqual(f.evidence.emailIds, ["msg-northwind-2026-03-20"]);
});

test("Streamflix duplicate within 3 days: high, one charge extra", () => {
  const [f] = by("Streamflix");
  assert.equal(f.type, "duplicate");
  assert.equal(f.confidence, "high");
  assert.equal(f.extraPaidCents, 1549);
});

test("Brightly $9.99 after trial, no email: medium new recurring", () => {
  const [f] = by("Brightly Premium");
  assert.equal(f.type, "new_recurring");
  assert.equal(f.confidence, "medium");
  assert.equal(f.extraPaidCents, 4 * 999);
});

test("Summit $120 → $138: high price jump with notice", () => {
  const [f] = by("Summit Health Insurance");
  assert.equal(f.type, "price_jump");
  assert.equal(f.confidence, "high");
  assert.equal(f.extraPaidCents, 3 * 1800);
  assert.deepEqual(f.evidence.emailIds, ["msg-summit-2026-06-01"]);
});

test("Cascade $40 → 41 → 42 → 43: medium creeping, $6 extra", () => {
  const [f] = by("Cascade Mobile");
  assert.equal(f.type, "creeping");
  assert.equal(f.confidence, "medium");
  assert.equal(f.extraPaidCents, 600);
});

test("electricity summer rise (false-alarm bait) is never above low", () => {
  for (const f of by("Metro Power & Light")) {
    assert.equal(f.confidence, "low");
    assert.ok(f.reasons.includes("seasonal_yoy"));
  }
});

test("rent, Harbor Wireless and groceries are not flagged", () => {
  for (const name of ["Oakwood Property Mgmt", "Harbor Wireless", "FreshMart"]) assert.deepEqual(by(name), [], name);
});

test("header counts only high and medium findings", () => {
  assert.deepEqual(summarizeFindings(result.findings), { count: 5, extraPaidCents: 31945, lowCount: 1 });
});

test("typical charges list statuses", () => {
  const status = Object.fromEntries(result.merchants.map((m) => [m.display, m.status]));
  assert.equal(status["Northwind Internet"], "changed");
  assert.equal(status["Brightly Premium"], "new");
  assert.equal(status["Metro Power & Light"], "normal");
  assert.equal(status["Oakwood Property Mgmt"], "normal");
  assert.ok(result.merchants.every((m) => m.monthly.length === 12));
});

test("deterministic: same input, same output", () => {
  assert.deepEqual(detect(inputFromPersona(generateMaria(), events)), result);
});
