import { test } from "node:test";
import assert from "node:assert/strict";
import { getDashboard } from "@/lib/dashboard";
import { currentDetection } from "../findings";
import { buildCaseFromFinding } from "../case-from-finding";
import { findingSummary } from "../summaries";
import { allowedNumbers, buildFacts } from "@/lib/llm/facts";
import { numbersIn } from "@/lib/llm/validate";
import { PROVIDERS } from "@/lib/providers";

test("mock dashboard: 5 looking off, 1 probably fine, $319.45 extra, 9 merchants", async () => {
  const d = await getDashboard({ lang: "es", mock: true, userId: null, inboxOff: false });
  assert.ok(d.ok);
  if (!d.ok) return;
  assert.equal(d.lookingOff.length, 5);
  assert.equal(d.probablyFine.length, 1);
  assert.deepEqual(d.summary, { count: 5, extraPaidCents: 31945, lowCount: 1, savedAnnualCents: 0 });
  assert.deepEqual(d.resolved, []);
  assert.equal(d.merchants.length, 9);
  assert.equal(d.source, "fixture");
  const nw = d.lookingOff.find((f) => f.display === "Northwind Internet")!;
  assert.equal(nw.evidence.email?.messageId, "msg-northwind-2026-03-20");
  assert.equal(d.merchants.find((m) => m.display === "Northwind Internet")?.changeMonth, "2026-04");
  const dup = d.lookingOff.find((f) => f.type === "duplicate")!;
  assert.deepEqual(dup.evidence.charges.map((c) => c.duplicate), [false, true]);
});

test("inbox disconnected: no email evidence anywhere", async () => {
  const d = await getDashboard({ lang: "en", mock: true, userId: null, inboxOff: true });
  assert.ok(d.ok && d.lookingOff.every((f) => f.evidence.email === null));
});

test("card summaries use only the finding's numbers, in every language", async () => {
  const { findings, billEvents } = await currentDetection({ mock: true });
  for (const f of findings) {
    const allowed = allowedNumbers(buildFacts(f, billEvents));
    for (const lang of ["en", "es", "zh", "ko"] as const) {
      for (const n of numbersIn(findingSummary(f, lang))) {
        assert.ok(allowed.some((a) => Math.abs(a - n) < 0.005), `${f.display} ${lang}: ${n}`);
      }
    }
  }
});

test("Call about this pre-fills the case from the finding", async () => {
  const { findings, billEvents } = await currentDetection({ mock: true });
  const nw = findings.find((f) => f.display === "Northwind Internet")!;
  const c = buildCaseFromFinding(nw, billEvents, "es");
  assert.equal(c.kind, "price");
  assert.equal(c.currentCents, 8900);
  assert.equal(c.targetCents, 5500);
  assert.equal(c.walkawayCents, 7200); // halfway, rounded up to a whole dollar
  assert.equal(c.caseFile.current_monthly, 89);
  assert.equal(c.caseFile.account_last4.length, 4);
  assert.equal(c.phone, PROVIDERS.find((p) => p.id === "northwind")!.phone);
  assert.ok(c.caseFile.competitor_offers.every((o) => o.monthly < 89 && o.source === "curated_json"));
  assert.match(c.intent.user_words, /\$55\.00/);
});

test("refund and cancel cases", async () => {
  const { findings, billEvents } = await currentDetection({ mock: true });
  const dup = buildCaseFromFinding(findings.find((f) => f.type === "duplicate")!, billEvents, "en");
  assert.equal(dup.kind, "refund");
  const sub = buildCaseFromFinding(findings.find((f) => f.type === "new_recurring")!, billEvents, "en");
  assert.equal(sub.kind, "cancel");
  assert.equal(sub.targetCents, 0);
});

test("phone numbers come only from the verified list, never from email", async () => {
  const { findings, billEvents } = await currentDetection({ mock: true });
  for (const f of findings) {
    const c = buildCaseFromFinding(f, billEvents, "en");
    assert.ok(!JSON.stringify(c).includes("900-555-0199"));
    if (c.phone) assert.ok(PROVIDERS.some((p) => p.phone === c.phone));
  }
});
