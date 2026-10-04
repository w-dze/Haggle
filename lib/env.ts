import { z } from "zod";

// Single source of truth for env vars (NFR-8). In production every value below
// should be required; for a scaffold that must boot `next dev` without keys,
// everything is optional and validated lazily. Call `requireEnv()` in code
// paths that genuinely need a key so failures are explicit and localized.
// Empty strings (e.g. `DATA_SOURCE=` copied from .env.example) mean "unset".
const blankToUndefined = (v: unknown) => (v === "" ? undefined : v);

const EnvSchema = z.object({
  GEMINI_API_KEY: z.string().optional(),
  // flash-latest aliases to 3.8-flash, which 503s under load. Lite has its own quota.
  GEMINI_MODEL_FAST: z.string().default("gemini-flash-lite-latest"),
  GEMINI_MODEL_SMART: z.string().default("gemini-flash-lite-latest"),
  GEMINI_MODEL_FALLBACKS: z
    .string()
    .default("gemini-3.5-flash-lite,gemini-3-flash-preview,gemini-flash-latest"),

  NESSIE_API_KEY: z.string().optional(),
  NESSIE_BASE_URL: z.string().default("https://api.nessieisreal.com"),

  XAI_API_KEY: z.string().optional(),
  XAI_VOICE_AGENT: z.string().default("eve"),
  XAI_VOICE_REP: z.string().default("ara"),

  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_AGENT_ID: z.string().optional(),
  ELEVENLABS_PHONE_NUMBER_ID: z.string().optional(),
  ELEVENLABS_WEBHOOK_SECRET: z.string().optional(),
  TOOL_SHARED_SECRET: z.string().optional(),

  DATABASE_URL: z.string().optional(),

  // Bill check-up. The LLM only phrases and translates; numbers come from code.
  LLM_PROVIDER: z.preprocess(blankToUndefined, z.enum(["xai"]).default("xai")).catch("xai"),
  XAI_MODEL: z.string().optional(), // default grok-4.20-non-reasoning (lib/llm/providers/xai.ts)
  // auto = Nessie when seeded and reachable, else the local fixture.
  DATA_SOURCE: z.preprocess(blankToUndefined, z.enum(["auto", "nessie", "fixture"]).default("auto")).catch("auto"),
  // Shows the "Demo - mock data" strip and labels calls as simulated.
  DEMO_MODE: z
    .string()
    .optional()
    .transform((v) => v !== "false"),

  APP_BASE_URL: z.string().default("http://localhost:3000"),
  CALL_ALLOWLIST: z.string().default(""),
  DEMO_USER_ID: z.string().optional(),
});

export const env = EnvSchema.parse(process.env);

/** Throw a clear error if a required key is missing at the point of use. */
export function requireEnv<K extends keyof typeof env>(key: K): NonNullable<(typeof env)[K]> {
  const value = env[key];
  if (value === undefined || value === "") {
    throw new Error(`Missing required env var: ${key}. See .env.example / PDR Appendix A.`);
  }
  return value as NonNullable<(typeof env)[K]>;
}

/** Parsed allowlist of destination numbers (§7.3 DoS / cost abuse control). */
export function callAllowlist(): string[] {
  return env.CALL_ALLOWLIST.split(",").map((s) => s.trim()).filter(Boolean);
}
