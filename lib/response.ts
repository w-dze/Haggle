import { NextResponse } from "next/server";

// Standard API envelope (§5.3): { ok, data?, error? }.
export type ApiError = { code: string; message_i18n: Record<string, string> };
export type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: ApiError };

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data } satisfies ApiResponse<T>, init);
}

export function fail(
  code: string,
  message_i18n: Record<string, string>,
  status = 400,
) {
  return NextResponse.json(
    { ok: false, error: { code, message_i18n } } satisfies ApiResponse<never>,
    { status },
  );
}

/** Shorthand for a message that is the same across locales (dev/internal errors). */
export function failMsg(code: string, message: string, status = 400) {
  return fail(code, { en: message, es: message, zh: message, ko: message }, status);
}
