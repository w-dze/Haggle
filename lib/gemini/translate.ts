import { env } from "@/lib/env";
import { generateText, loadPrompt } from "./client";
import { numbersMatch } from "@/lib/guardrails/numbers";

// Per-line translation of the English call to the user's language (§5.5, §5.7).
// Low temperature; glossary keeps provider/plan names in English. Numbers are
// verified deterministically and the translation is retried once on mismatch.
export async function translateLine(input: {
  textEn: string;
  context: string[]; // previous ~3 lines (English)
  targetLang: string;
}): Promise<{ text: string; numbersOk: boolean }> {
  const prompt = loadPrompt("translate.md");
  const build = (extra = "") =>
    generateText({
      model: env.GEMINI_MODEL_FAST,
      parts: [
        {
          text:
            `${prompt}\n\nTarget language: ${input.targetLang}\n` +
            `Context (English, most recent last):\n${input.context.join("\n")}\n\n` +
            `Translate this line only:\n${input.textEn}${extra}`,
        },
      ],
    });

  let text = (await build()).trim();
  if (numbersMatch(input.textEn, text)) return { text, numbersOk: true };

  // Retry once, forcing the exact numbers.
  text = (
    await build(`\n\nPreserve these numbers exactly: ${input.textEn}`)
  ).trim();
  return { text, numbersOk: numbersMatch(input.textEn, text) };
}
