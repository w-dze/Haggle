import { test } from "node:test";
import assert from "node:assert/strict";
import { readDemoInbox } from "../fixture";
import { extractBillEvent } from "../extract";

const inbox = Object.fromEntries(readDemoInbox().map((m) => [m.id, m]));

test("Northwind notice: from/to amounts and due date", () => {
  const e = extractBillEvent(inbox["msg-northwind-2026-03-20"]);
  assert.equal(e.provider, "Northwind Internet");
  assert.equal(e.changeType, "price_increase");
  assert.equal(e.previousAmountCents, 5500);
  assert.equal(e.amountCents, 8900);
  assert.equal(e.dueDate, "2026-04-12");
  assert.equal(e.trusted, true);
});

test("Summit notice: '(previously $X)' form and effective date", () => {
  const e = extractBillEvent(inbox["msg-summit-2026-06-01"]);
  assert.equal(e.provider, "Summit Health Insurance");
  assert.equal(e.previousAmountCents, 12000);
  assert.equal(e.amountCents, 13800);
  assert.equal(e.effectiveDate, "2026-07-01");
  assert.equal(e.dueDate, "2026-07-20");
});

test("Streamflix receipt", () => {
  const e = extractBillEvent(inbox["msg-streamflix-2026-09-05"]);
  assert.equal(e.changeType, "receipt");
  assert.equal(e.amountCents, 1549);
  assert.equal(e.effectiveDate, "2026-09-05");
});

test("unverified sender: nothing extracted, no phone number, untrusted", () => {
  const e = extractBillEvent(inbox["msg-refund-2026-09-28"]);
  assert.equal(e.trusted, false);
  assert.equal(e.changeType, "unverified_sender");
  assert.equal(e.provider, null);
  assert.equal(e.amountCents, null);
  assert.ok(!JSON.stringify(e).includes("900"), "no number from the email body is kept");
});

test("every extracted amount is a finite integer or null", () => {
  for (const msg of readDemoInbox()) {
    const e = extractBillEvent(msg);
    for (const v of [e.amountCents, e.previousAmountCents]) {
      assert.ok(v === null || Number.isInteger(v), `${msg.id}: ${v}`);
    }
  }
});
