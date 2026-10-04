import { test } from "node:test";
import assert from "node:assert/strict";
import { numbersIn, validateSections } from "../validate";

const s = (what: string[]) => ({ what, causes: [], actions: [], questions: [] });

test("reads dollar, thousands, decimal-comma and ISO-date formats", () => {
  assert.deepEqual(numbersIn("$1,450.00 and $89.00"), [1450, 89]);
  assert.deepEqual(numbersIn("89,00 $ y 1.450 €"), [89, 1450]);
  assert.deepEqual(numbersIn("2026-04-12"), [2026, 4, 12]);
  assert.deepEqual(numbersIn("2026年4月12日 涨了 $34.00"), [2026, 4, 12, 34]);
});

test("Chinese numerals count only next to a unit", () => {
  assert.deepEqual(numbersIn("连续三次上涨"), [3]);
  assert.deepEqual(numbersIn("请一定确认一下"), []);
});

test("Korean particles are not read as numbers", () => {
  assert.deepEqual(numbersIn("요금이 올랐습니다"), []);
});

test("accepts numbers from the finding and rejects invented ones", () => {
  assert.equal(validateSections(s(["From $55.00 to $89.00, 62% higher."]), [55, 89, 62]).ok, true);
  const bad = validateSections(s(["From $55.00 to $90.00."]), [55, 89]);
  assert.equal(bad.ok, false);
});

test("rejects accusatory wording in every language", () => {
  for (const text of ["This is unfair.", "Te están cobrando de forma injusta.", "这是乱收费。", "부당한 요금입니다.", "You were overcharged."]) {
    assert.equal(validateSections(s([text]), []).ok, false, text);
  }
});

test("rejects phone numbers and links", () => {
  assert.equal(validateSections(s(["Call 800-555-0142."]), [800, 555, 142]).ok, false);
  assert.equal(validateSections(s(["See https://example.com"]), []).ok, false);
});
