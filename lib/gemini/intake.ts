import { env } from "@/lib/env";
import { generateJson, loadPrompt } from "./client";
import { Intent } from "@/lib/schemas";

/** Local intent parse — no Gemini call. Keeps the demo path inside the 5/min free quota. */
export function inferIntent(goalText: string): Intent {
  const t = goalText.toLowerCase();
  let goal: Intent["goal"] = "lower_price";
  if (/cancel|cancelar|取消|해지|취소/.test(t)) goal = "cancel";
  else if (/downgrade|bajar de plan|bajar el plan|降级|다운그레이드/.test(t)) goal = "downgrade";
  else if (/\bfee\b|cargo|cuota|费用|수수료/.test(t)) goal = "remove_fee";
  return { goal, user_words: goalText, constraints: [] };
}

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
