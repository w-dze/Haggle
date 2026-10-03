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

const QUOTA_I18N = {
  en: "Gemini's free limit is 5 requests a minute. Wait about a minute, then try again.",
  es: "Gemini tiene un límite gratuito de 5 solicitudes por minuto. Espera un minuto e inténtalo de nuevo.",
  zh: "Gemini 免费额度每分钟只有 5 次请求。请等大约一分钟再试。",
  ko: "Gemini 무료 한도는 분당 5회입니다. 약 1분 기다린 뒤 다시 시도해 주세요.",
};

const BUSY_I18N = {
  en: "Gemini is busy right now. Wait 15 seconds and try once more.",
  es: "Gemini está ocupado ahora. Espera 15 segundos e inténtalo una vez más.",
  zh: "Gemini 现在很忙。请等 15 秒再试一次。",
  ko: "Gemini가 지금 혼잡합니다. 15초 기다린 뒤 한 번만 다시 시도해 주세요.",
};

/** Map Gemini errors to a user-facing envelope. Quota/overload → not a raw stack dump. */
export function failGemini(err: unknown, fallbackCode: string) {
  const msg = String(err);
  if (/429|RESOURCE_EXHAUSTED|quota exceeded/i.test(msg)) {
    return fail("gemini_quota", QUOTA_I18N, 429);
  }
  if (/503|UNAVAILABLE|high demand/i.test(msg)) {
    return fail("gemini_busy", BUSY_I18N, 503);
  }
  return failMsg(fallbackCode, msg, 500);
}
