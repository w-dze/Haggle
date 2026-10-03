import { z } from "zod";

// Single source of truth for env vars (NFR-8). In production every value below
// should be required; for a scaffold that must boot `next dev` without keys,
// everything is optional and validated lazily. Call `requireEnv()` in code
// paths that genuinely need a key so failures are explicit and localized.
const EnvSchema = z.object({
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL_FAST: z.string().default("gemini-3.8-flash"),
  GEMINI_MODEL_SMART: z.string().default("gemini-3.8-flash"),

  NESSIE_API_KEY: z.string().optional(),
  NESSIE_BASE_URL: z.string().default("http://api.nessieisreal.com"),

  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_AGENT_ID: z.string().optional(),
  ELEVENLABS_PHONE_NUMBER_ID: z.string().optional(),
  ELEVENLABS_WEBHOOK_SECRET: z.string().optional(),
  TOOL_SHARED_SECRET: z.string().optional(),

  DATABASE_URL: z.string().optional(),

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
