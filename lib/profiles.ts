import type { Locale } from "@/lib/i18n";

// Demo profiles, one per language, matching the intake demo accounts
// (data/nessie_demo.json). Choosing a language signs in as that profile.
// All profiles see the same simulated bank data; only the name differs.

export type Profile = { lang: Locale; name: string; first: string; initials: string; tint: string };

export const PROFILES: Record<Locale, Profile> = {
  es: { lang: "es", name: "Maria Lopez", first: "Maria", initials: "ML", tint: "#f4d9c6" },
  zh: { lang: "zh", name: "Wei Chen", first: "Wei", initials: "WC", tint: "#d6e6d2" },
  ko: { lang: "ko", name: "Jiwoo Kim", first: "Jiwoo", initials: "JK", tint: "#d9dcf3" },
  en: { lang: "en", name: "Alex Rivera", first: "Alex", initials: "AR", tint: "#c5f0f7" },
};

export function profileFor(lang: string): Profile {
  return PROFILES[lang as Locale] ?? PROFILES.en;
}
