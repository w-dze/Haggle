import Link from "next/link";
import { getTranslator } from "@/lib/i18n";

// Screen 5 — debrief: result, before -> after, annual savings, next steps (§5.8, FR-26..FR-27).
// TODO(B/C): load outcome + debrief_i18n[lang] by call id.
export default async function Debrief({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  const t = getTranslator(lang);

  return (
    <div className="flex flex-col gap-6 px-4 pt-6 pb-8">
      <h1 className="text-2xl font-bold">{t("debrief_title")}</h1>

      <div className="rounded-2xl border border-accent/30 bg-accent/5 p-6 flex flex-col gap-2">
        <span className="text-sm text-muted">{t("debrief_savings")}</span>
        {/* TODO: before -> after price, monthly + annual savings */}
        <p className="text-3xl font-bold">—</p>
      </div>

      <section className="rounded-xl border border-foreground/10 p-4">
        <p className="text-muted text-sm">call:{id}</p>
      </section>

      <Link href={`/${lang}/history`} className="text-sm underline text-muted">
        {t("debrief_view_audit")}
      </Link>
    </div>
  );
}
