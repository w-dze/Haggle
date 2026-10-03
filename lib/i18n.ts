// Hand-rolled i18n (PDR §4.7, §5.9). ~60 keys, so no library needed.
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import zh from "@/messages/zh.json";
import ko from "@/messages/ko.json";

// User-facing locales. English is also the negotiation language on the call,
// but here it is only the development/fallback UI locale.
export const LOCALES = ["es", "zh", "ko", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_LABELS: Record<Locale, string> = {
  es: "Español",
  zh: "中文",
  ko: "한국어",
  en: "English",
};

type Messages = typeof en;

const DICTIONARIES: Record<Locale, Messages> = {
  en,
  es: es as Messages,
  zh: zh as Messages,
  ko: ko as Messages,
};

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export function getMessages(lang: string): Messages {
  return isLocale(lang) ? DICTIONARIES[lang] : DICTIONARIES[DEFAULT_LOCALE];
}

/**
 * Returns a translator bound to a locale. Falls back to English, then to the
 * key itself, so a missing string is never a crash (NFR-3: no English-only
 * errors on the user path — fill in all four message files before the demo).
 */
export function getTranslator(lang: string) {
  const messages = getMessages(lang);
  return function t(key: keyof Messages): string {
    return (messages[key] as string) ?? (en[key] as string) ?? String(key);
  };
}
