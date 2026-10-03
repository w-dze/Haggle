import type { Config } from "drizzle-kit";
import { config } from "dotenv";

// Load .env.local first (Next.js convention), then fall back to .env.
config({ path: [".env.local", ".env"] });

export default {
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  verbose: true,
  strict: true,
} satisfies Config;
