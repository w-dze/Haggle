import { NextResponse, type NextRequest } from "next/server";

// Language persistence. The picker shows only until a language is chosen:
// - /app sends returning visitors to their dashboard, new ones to the picker.
// - /{lang} (the picker) sends returning visitors to their dashboard, unless
//   ?pick=1 ("Change language") or ?mock=1 (the /demo phone frame, which must
//   always start on the picker).
// `/` stays the marketing site. Nothing else is matched.

const LOCALES = new Set(["es", "zh", "ko", "en"]);

export function middleware(req: NextRequest) {
  const saved = req.cookies.get("haggle_lang")?.value;
  const lang = saved && LOCALES.has(saved) ? saved : null;
  const { pathname, searchParams } = req.nextUrl;
  const to = (path: string) => NextResponse.redirect(new URL(path, req.url));

  if (pathname === "/app") return to(lang ? `/${lang}/dashboard` : "/en");

  if (searchParams.get("mock") === "1" || searchParams.get("pick") === "1") return NextResponse.next();
  if (lang) return to(`/${lang}/dashboard`);
  return NextResponse.next();
}

export const config = {
  matcher: ["/app", "/en", "/es", "/zh", "/ko"],
};
