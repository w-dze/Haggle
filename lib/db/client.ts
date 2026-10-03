import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { env } from "@/lib/env";
import * as schema from "./schema";

// Lazy singleton so `next build` / `next dev` can start without DATABASE_URL.
// Any route that touches the DB will throw a clear error if it is unset.
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (_db) return _db;
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. See .env.example / PDR Appendix A.");
  }
  const sql = neon(env.DATABASE_URL);
  _db = drizzle(sql, { schema });
  return _db;
}

export { schema };
