import "dotenv/config";

// Evaluation harness (Stretch X2, §9.2–§9.3). Runs the negotiator against
// scripted rep personas and reports savings rate, agreement rate, guardrail
// violations, subtitle accuracy, number fidelity and latency.

const PERSONAS = ["friendly", "stubborn", "confused", "manipulative", "verification_required"] as const;

type Result = {
  persona: (typeof PERSONAS)[number];
  agreed: boolean;
  oldMonthly: number;
  newMonthly: number;
  guardrailViolations: number;
};

async function runPersona(persona: (typeof PERSONAS)[number]): Promise<Result> {
  // TODO: drive a scripted call (or a simulated transcript) and score it.
  console.log(`[eval] persona=${persona} — TODO: implement`);
  return { persona, agreed: false, oldMonthly: 0, newMonthly: 0, guardrailViolations: 0 };
}

async function main() {
  const results: Result[] = [];
  for (const p of PERSONAS) results.push(await runPersona(p));
  console.table(results);
}

main();
