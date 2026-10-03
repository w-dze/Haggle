import { getTranslator } from "@/lib/i18n";

// Screen 2 — intake: bill photo OR seeded Nessie customer + free-text goal (§5.8, FR-1..FR-6).
// TODO(B/C): wire the upload to POST /api/bills/ocr, the Nessie picker to
// /api/case-files, and the goal box to POST /api/intake. This is a static stub.
export default async function Intake({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const t = getTranslator(lang);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t("intake_title")}</h1>

      <section className="rounded-xl border border-foreground/10 p-4 flex flex-col gap-3">
        <label className="font-medium">{t("intake_upload")}</label>
        {/* TODO: <input type="file" accept="image/*,application/pdf" capture="environment" /> */}
        <div className="h-32 rounded-lg border border-dashed border-foreground/20 grid place-items-center text-muted">
          {t("intake_upload")}
        </div>
        <button className="text-sm text-muted underline self-start">
          {t("intake_use_demo")}
        </button>
      </section>

      <section className="flex flex-col gap-2">
        <label className="font-medium">{t("intake_goal_label")}</label>
        <textarea
          className="rounded-lg bg-foreground/5 border border-foreground/10 p-3 min-h-24"
          placeholder={t("intake_goal_placeholder")}
        />
      </section>

      <button className="btn-approve bg-accent text-background">
        {t("case_start_call")}
      </button>
    </div>
  );
}
