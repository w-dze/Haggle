// Runs the bill check-up detector against labeled injected anomalies and
// false-alarm bait, and prints caught / missed / false alarms with precision
// and recall. Deterministic (fixed seed). The same report is on /eval.
//
//   npm run eval:detector

import { runEval } from "../lib/detect/eval";

const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);

const report = runEval();
console.log(`Detector eval: ${report.personas} personas (Maria + ${report.personas - 1} synthetic), seed ${report.seed}`);
console.log("An alarm is a high or medium finding. Low findings count as 'probably fine'.\n");

console.table(
  Object.fromEntries(
    [...report.rows, { type: "TOTAL", ...report.total }].map((r) => [
      r.type,
      {
        injected: r.injected,
        caught: r.caught,
        missed: r.missed,
        "of which below threshold": r.missedSubtle,
        "false alarms": r.falseAlarms,
        precision: pct(r.precision),
        recall: pct(r.recall),
      },
    ]),
  ),
);

console.log("\nFalse-alarm bait (should raise no alarms):");
console.table(
  Object.fromEntries(
    report.baits.map((b) => [b.name, { instances: b.instances, alarms: b.alarms, "shown as low": b.lowFindings }]),
  ),
);

if (report.missedExamples.length) {
  console.log("\nMissed:");
  for (const m of report.missedExamples.slice(0, 15))
    console.log(`  ${m.persona}: ${m.type} on ${m.merchant}${m.subtle ? " (below threshold, expected)" : ""}`);
}
if (report.falseAlarmExamples.length) {
  console.log("\nFalse alarms:");
  for (const f of report.falseAlarmExamples.slice(0, 15)) console.log(`  ${f.persona}: ${f.type} (${f.confidence}) on ${f.merchant}`);
}
