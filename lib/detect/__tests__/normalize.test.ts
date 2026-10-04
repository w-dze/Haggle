import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanStatementText, normalizeMerchant } from "../normalize";

test("strips phone numbers, domains, store numbers and noise words", () => {
  assert.equal(cleanStatementText("STREAMFLIX.COM 866-555-0110"), "streamflix");
  assert.equal(cleanStatementText("FRESHMART #1234"), "freshmart");
  assert.equal(cleanStatementText("CASCADE MOBILE BILL PMT"), "cascade mobile");
});

test("aliases map statement text and provider names to one key", () => {
  assert.equal(normalizeMerchant("NORTHWIND INTERNET*AUTOPAY").key, normalizeMerchant("Northwind Internet").key);
  assert.equal(normalizeMerchant("FRESHMART 0567").key, normalizeMerchant("FRESHMART #1234").key);
  assert.equal(normalizeMerchant("SUMMIT HEALTH INS PREMIUM").display, "Summit Health Insurance");
});

test("unknown merchants fall back to a title-cased cleaned name", () => {
  assert.deepEqual(normalizeMerchant("ACME GYM #22 LLC"), { key: "acme-gym", display: "Acme Gym" });
});
