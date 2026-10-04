"use server";

import { redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { saveLanguage } from "@/lib/user";
import { writeAudit } from "@/lib/audit";
import { env } from "@/lib/env";

// Language picker submit: remember the choice, then go to the dashboard.
export async function chooseLanguage(formData: FormData) {
  const lang = String(formData.get("lang") ?? "");
  if (!isLocale(lang)) redirect("/en");
  const { userId } = await saveLanguage(lang);
  if (userId && env.DATABASE_URL) {
    await writeAudit({ actor: "user", event: "language.chosen", userId, payload: { lang } }).catch(() => {});
  }
  redirect(`/${lang}/dashboard`);
}
