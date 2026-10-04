import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { env } from "@/lib/env";
import { isLocale, type Locale } from "@/lib/i18n";

// Anonymous check-up users. The language choice lives in a cookie (so the
// redirect works without a database) and in Neon `users.preferred_lang`.
// The user id is an httpOnly cookie; no name, email or phone is collected.

export const LANG_COOKIE = "haggle_lang";
export const UID_COOKIE = "haggle_uid";

const YEAR = 60 * 60 * 24 * 365;
const cookieOpts = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: YEAR,
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The saved language, if any. */
export async function savedLanguage(): Promise<Locale | null> {
  const v = (await cookies()).get(LANG_COOKIE)?.value;
  return v && isLocale(v) ? v : null;
}

/** The current anonymous user id, if one was created. Never creates one. */
export async function currentUserId(): Promise<string | null> {
  const v = (await cookies()).get(UID_COOKIE)?.value;
  return v && UUID.test(v) ? v : null;
}

/**
 * Save the language choice: cookie first (always), then Neon. Creates the
 * anonymous user on first use. Only callable from a server action or route
 * handler, because it sets cookies. Never throws on a database problem.
 */
export async function saveLanguage(lang: Locale): Promise<{ userId: string | null; stored: boolean }> {
  const jar = await cookies();
  jar.set(LANG_COOKIE, lang, cookieOpts);

  if (!env.DATABASE_URL) return { userId: null, stored: false };
  try {
    const { getDb } = await import("@/lib/db/client");
    const { users } = await import("@/lib/db/schema");
    const db = getDb();
    const existing = await currentUserId();
    if (existing) {
      const updated = await db
        .update(users)
        .set({ preferredLang: lang })
        .where(eq(users.id, existing))
        .returning({ id: users.id });
      if (updated.length) return { userId: existing, stored: true };
    }
    const [row] = await db.insert(users).values({ preferredLang: lang }).returning({ id: users.id });
    jar.set(UID_COOKIE, row.id, cookieOpts);
    return { userId: row.id, stored: true };
  } catch (err) {
    console.warn(`[user] language saved in cookie only: ${err instanceof Error ? err.message : err}`);
    return { userId: null, stored: false };
  }
}
