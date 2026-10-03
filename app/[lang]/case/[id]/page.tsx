import { getTranslator } from "@/lib/i18n";
import { loadStoredCase } from "@/lib/case-files";
import { formatMoney } from "@/lib/money";
import { WalkawaySlider } from "../WalkawaySlider";

export default async function CasePage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  const t = getTranslator(lang);

  let stored: Awaited<ReturnType<typeof loadStoredCase>> = null;
  try {
    stored = await loadStoredCase(id);
  } catch {
    stored = null;
  }

  if (!stored) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">{t("case_title")}</h1>
        <p className="text-muted">{t("case_not_found")}</p>
      </div>
    );
  }

  const { caseFile, explanationI18n, walkawayCents, currentCents, targetCents } = stored;
  const explanation = explanationI18n[lang] ?? explanationI18n.en ?? "";
  const currentDollars = Math.max(Math.round(currentCents / 100), Math.round(walkawayCents / 100));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t("case_title")}</h1>
      {caseFile.provider && (
        <p className="text-muted">
          {caseFile.provider}
          {caseFile.service ? ` · ${caseFile.service}` : ""}
          {caseFile.account_last4 ? ` · ••••${caseFile.account_last4}` : ""}
        </p>
      )}

      <div className="grid grid-cols-1 gap-3">
        <article className="rounded-xl border border-foreground/10 p-4">
          <h2 className="font-semibold">{t("case_you_pay")}</h2>
          <p className="text-3xl font-bold mt-2">{formatMoney(currentCents, lang)}</p>
        </article>
        <article className="rounded-xl border border-foreground/10 p-4">
          <h2 className="font-semibold">{t("case_looks_wrong")}</h2>
          <ul className="mt-2 list-disc pl-5 text-muted space-y-1">
            {caseFile.issues.length ? (
              caseFile.issues.map((issue) => <li key={issue}>{issue}</li>)
            ) : (
              <li>{explanation || "—"}</li>
            )}
          </ul>
        </article>
        <article className="rounded-xl border border-foreground/10 p-4">
          <h2 className="font-semibold">{t("case_good_result")}</h2>
          <p className="text-2xl font-bold mt-2">{formatMoney(targetCents, lang)}</p>
          {explanation && <p className="mt-3 text-sm leading-relaxed">{explanation}</p>}
        </article>
      </div>

      {caseFile.competitor_offers.length > 0 && (
        <section className="rounded-xl border border-foreground/10 p-4">
          <h2 className="font-semibold">{t("case_competitors")}</h2>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            {caseFile.competitor_offers.map((o) => (
              <li key={`${o.provider}-${o.plan}`}>
                {o.provider} · {o.plan} · ${o.monthly.toFixed(0)}/mo
              </li>
            ))}
          </ul>
        </section>
      )}

      <WalkawaySlider
        caseId={id}
        lang={lang}
        initialCents={walkawayCents}
        maxDollars={currentDollars}
        label={t("case_walkaway")}
        savedLabel={t("case_walkaway_saved")}
      />

      <p className="text-xs text-muted">{t("case_consent")}</p>
      <button disabled className="btn-approve bg-accent/50 text-background cursor-not-allowed">
        {t("case_call_soon")}
      </button>
    </div>
  );
}
