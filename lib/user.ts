import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { env } from "@/lib/env";
import { isLocale, type Locale } from "@/lib/i18n";
import { profileFor } from "@/lib/profiles";

// Anonymous check-up users. The language choice lives in a cookie (so the
// redirect works without a database) and in Neon `users.preferred_lang`.
// The user id is an httpOnly cookie; no name, email or phone is collected.

export const LANG_COOKIE = "haggle_lang";
export const UID_COOKIE = "haggle_uid";
/** Set when the user taps "Disconnect" on the demo inbox (a stub: nothing is really connected). */
export const INBOX_OFF_COOKIE = "haggle_inbox_off";

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
        .set({ preferredLang: lang, displayName: profileFor(lang).name })
        .where(eq(users.id, existing))
        .returning({ id: users.id });
      if (updated.length) return { userId: existing, stored: true };
    }
    const [row] = await db
      .insert(users)
      .values({ preferredLang: lang, displayName: profileFor(lang).name })
      .returning({ id: users.id });
    jar.set(UID_COOKIE, row.id, cookieOpts);
    return { userId: row.id, stored: true };
  } catch (err) {
    console.warn(`[user] language saved in cookie only: ${err instanceof Error ? err.message : err}`);
    return { userId: null, stored: false };
  }
}

/** Whether the (demo) inbox has been disconnected. */
export async function inboxDisconnected(): Promise<boolean> {
  return (await cookies()).get(INBOX_OFF_COOKIE)?.value === "1";
}

export async function setInboxDisconnected(off: boolean) {
  const jar = await cookies();
  if (off) jar.set(INBOX_OFF_COOKIE, "1", cookieOpts);
  else jar.delete(INBOX_OFF_COOKIE);
}

/**
 * The current user id, creating an anonymous user if needed (for example when
 * someone opens /es/dashboard directly without using the picker). Route
 * handlers and server actions only. Returns null if the database is down.
 */
export async function ensureUser(lang: string): Promise<string | null> {
  const existing = await currentUserId();
  if (!env.DATABASE_URL) return existing;
  try {
    const { getDb } = await import("@/lib/db/client");
    const { users } = await import("@/lib/db/schema");
    const db = getDb();
    if (existing) {
      const [row] = await db.select({ id: users.id }).from(users).where(eq(users.id, existing)).limit(1);
      if (row) return existing;
    }
    const preferredLang = isLocale(lang) ? lang : "en";
    const [row] = await db
      .insert(users)
      .values({ preferredLang, displayName: profileFor(preferredLang).name })
      .returning({ id: users.id });
    (await cookies()).set(UID_COOKIE, row.id, cookieOpts);
    return row.id;
  } catch (err) {
    console.warn(`[user] could not create user: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}
