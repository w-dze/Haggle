import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { env, requireEnv } from "@/lib/env";

/** Loads a versioned prompt from /prompts (NFR-8). */
export function loadPrompt(file: string): string {
  return readFileSync(join(process.cwd(), "prompts", file), "utf8");
}

// Thin Gemini wrapper (§5.5). Uses JSON mime type + Zod validation. Add the
// SDK's native responseSchema once model/field names are confirmed [Verify V9].

let _ai: GoogleGenAI | null = null;

export function getGenAI(): GoogleGenAI {
  if (!_ai) _ai = new GoogleGenAI({ apiKey: requireEnv("GEMINI_API_KEY") });
  return _ai;
}

type GenInput = {
  model?: string;
  parts: unknown[]; // text and/or inline image parts
};

/**
 * Generates JSON and validates it against `schema`. Retries once on parse
 * failure with the error appended to the prompt (§5.5).
 */
export async function generateJson<S extends z.ZodTypeAny>(
  input: GenInput,
  schema: S,
): Promise<z.infer<S>> {
  const ai = getGenAI();
  const model = input.model ?? env.GEMINI_MODEL_FAST;

  const run = async (extra?: string): Promise<z.infer<S>> => {
    const parts = extra ? [...input.parts, { text: extra }] : input.parts;
    const res = await ai.models.generateContent({
      model,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      contents: [{ role: "user", parts: parts as any }],
      config: { responseMimeType: "application/json" },
    });
    const text = res.text ?? "{}";
    return schema.parse(JSON.parse(text));
  };

  try {
    return await run();
  } catch (err) {
    return run(`Your previous output failed validation: ${String(err)}. Return valid JSON only.`);
  }
}

/** Plain text generation (translation, prose debrief). */
export async function generateText(input: GenInput): Promise<string> {
  const ai = getGenAI();
  const model = input.model ?? env.GEMINI_MODEL_FAST;
  const res = await ai.models.generateContent({
    model,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contents: [{ role: "user", parts: input.parts as any }],
  });
  return res.text ?? "";
}
