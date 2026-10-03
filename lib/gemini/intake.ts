import { env } from "@/lib/env";
import { generateJson, loadPrompt } from "./client";
import { Intent } from "@/lib/schemas";

// Goal text (user's language) -> structured Intent (§5.5, FR-5).
export async function parseIntent(goalText: string, lang: string): Promise<Intent> {
  const prompt = loadPrompt("intake.md");
  return generateJson(
    {
      model: env.GEMINI_MODEL_FAST,
      parts: [{ text: `${prompt}\n\nUser language: ${lang}\nUser goal: ${goalText}` }],
    },
    Intent,
  );
}
