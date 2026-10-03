import { z } from "zod";
import { env } from "@/lib/env";
import { generateJson, loadPrompt } from "./client";
import { CaseFile, type BillExtraction, type Intent } from "@/lib/schemas";

// Analyst: extraction + Nessie data + competitor JSON + intent -> CaseFile +
// explanation in the user's language (§5.5, FR-8..FR-10). Rule: only cite
// competitor offers present in the provided JSON.
const AnalystOutput = z.object({
  case_file: CaseFile,
  explanation: z.string(),
});
export type AnalystOutput = z.infer<typeof AnalystOutput>;

export async function buildCaseFile(input: {
  extraction: BillExtraction;
  intent: Intent;
  nessie?: unknown;
  competitorPlans: unknown;
  targetLang: string;
}): Promise<AnalystOutput> {
  const prompt = loadPrompt("analyst.md");
  const payload = JSON.stringify(
    {
      extraction: input.extraction,
      intent: input.intent,
      nessie: input.nessie ?? null,
      competitor_plans: input.competitorPlans,
      target_language: input.targetLang,
    },
    null,
    2,
  );
  return generateJson(
    {
      model: env.GEMINI_MODEL_SMART,
      parts: [{ text: `${prompt}\n\nINPUT:\n${payload}` }],
    },
    AnalystOutput,
  );
}
