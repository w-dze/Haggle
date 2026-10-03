import { getTranslator } from "@/lib/i18n";

// Screen 6 (Should tier, S5) — call history + audit trail timeline (§5.8, FR-28).
// TODO(C): list past calls with transcripts and the audit trail.
export default async function History({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const t = getTranslator(lang);

  return (
    <div className="flex flex-col gap-6 px-4 pt-6 pb-8">
      <h1 className="text-2xl font-bold">{t("history_title")}</h1>
      <p className="text-muted">—</p>
    </div>
  );
}
