import Link from "next/link";
import { getTranslator } from "@/lib/i18n";
import { debriefFromOutcome, loadCallOutcome } from "@/lib/outcomes";
import { formatMoney } from "@/lib/money";
import { MOCK_OUTCOME, mockHref } from "@/lib/mock-call";
import { Card } from "@/components/ui/card";
import { StatCallout } from "@/components/ui/stat-callout";

export default async function DebriefPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; id: string }>;
  searchParams: Promise<{ mock?: string }>;
}) {
  const { lang, id } = await params;
  const mock = (await searchParams).mock === "1";
  const t = getTranslator(lang);

  if (mock) {
    const annual = (MOCK_OUTCOME.old - MOCK_OUTCOME.new) * 12;
    return (
      <div className="flex flex-col gap-6 px-4 pt-6 pb-8">
        <h1 className="text-3xl">{t("debrief_title")}</h1>
        <Card className="flex flex-col gap-3 p-6">
          <StatCallout value={`$${annual}`} label={t("debrief_savings")} tone="success" />
          <p className="text-sm text-muted">
            ${MOCK_OUTCOME.old} → ${MOCK_OUTCOME.new} {t("per_month")}
          </p>
        </Card>
        <Link
          href={mockHref(`/${lang}/history`, true)}
          className="text-sm text-muted underline"
        >
          {t("debrief_view_audit")}
        </Link>
      </div>
    );
  }

  let packed: Awaited<ReturnType<typeof loadCallOutcome>> = null;
  try {
    packed = await loadCallOutcome(id);
  } catch {
    packed = null;
  }

  const debrief = packed?.outcome ? debriefFromOutcome(packed.outcome, lang) : null;
  const killed = packed?.call.status === "killed";
  const savingsCents = packed?.outcome?.annualSavingsCents ?? 0;

  return (
    <div className="flex flex-col gap-6 px-4 pt-6 pb-8">
      <h1 className="text-3xl">{t("debrief_title")}</h1>

      <Card className="flex flex-col gap-3 p-6">
        <StatCallout
          value={killed ? t("debrief_killed") : savingsCents ? formatMoney(savingsCents, lang) : "—"}
          label={killed ? t("call_ended") : t("debrief_savings")}
          tone={killed ? "default" : "success"}
        />
        {debrief?.old_monthly != null && debrief.new_monthly != null && (
          <p className="text-sm text-muted">
            ${debrief.old_monthly} → ${debrief.new_monthly}
            {debrief.confirmation_ref ? ` · ${debrief.confirmation_ref}` : ""}
          </p>
        )}
      </Card>

      {debrief?.prose && (
        <Card as="section">
          <p className="leading-relaxed">{debrief.prose}</p>
        </Card>
      )}

      {debrief?.next_steps?.length ? (
        <Card as="section">
          <h2 className="mb-2 font-sans text-base font-semibold">{t("debrief_next")}</h2>
          <ul className="list-disc space-y-1 pl-5 text-muted">
            {debrief.next_steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Link href={`/${lang}/history`} className="text-sm text-muted underline">
        {t("debrief_view_audit")}
      </Link>
    </div>
  );
}
