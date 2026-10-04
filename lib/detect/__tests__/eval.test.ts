import { test } from "node:test";
import assert from "node:assert/strict";
import { runEval } from "../eval";

const report = runEval();

test("every above-threshold injected anomaly is caught", () => {
  for (const r of report.rows) assert.equal(r.missed, r.missedSubtle, `${r.type}: ${r.missed - r.missedSubtle} real misses`);
});

test("no false alarms, and the bait never raises an alarm", () => {
  assert.equal(report.total.falseAlarms, 0, JSON.stringify(report.falseAlarmExamples.slice(0, 5)));
  for (const b of report.baits) assert.equal(b.alarms, 0, b.name);
});
