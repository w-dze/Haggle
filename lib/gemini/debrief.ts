import { env } from "@/lib/env";
import { generateJson, loadPrompt } from "./client";
import { Debrief, type CaseFile } from "@/lib/schemas";

// Post-call debrief in the user's language (§5.5, FR-26).
export async function writeDebrief(input: {
  caseFile: CaseFile;
  transcriptEn: string;
  targetLang: string;
}): Promise<Debrief> {
  const prompt = loadPrompt("debrief.md");
  const payload = JSON.stringify(
    {
      case_file: input.caseFile,
      transcript: input.transcriptEn,
      target_language: input.targetLang,
    },
    null,
    2,
  );
  return generateJson(
    {
      model: env.GEMINI_MODEL_FAST,
      parts: [{ text: `${prompt}\n\nINPUT:\n${payload}` }],
    },
    Debrief,
  );
}
