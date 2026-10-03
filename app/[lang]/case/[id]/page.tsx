import { getTranslator } from "@/lib/i18n";
import { loadStoredCase } from "@/lib/case-files";
import { formatMoney } from "@/lib/money";
import { MOCK_CASE, mockHref } from "@/lib/mock-call";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Caption } from "@/components/ui/caption";
import { StatCallout } from "@/components/ui/stat-callout";
import { WalkawaySlider } from "../WalkawaySlider";
import { StartCallButton } from "../StartCallButton";

function pick(text: { en: string; es: string; zh: string; ko: string }, lang: string) {
  return text[lang as keyof typeof text] ?? text.en;
}

export default async function CasePage({
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
    return (
      <div className="flex flex-col gap-6 px-4 pt-6 pb-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl">{t("case_title")}</h1>
          <p className="text-muted">
            {MOCK_CASE.provider} · {MOCK_CASE.service} · ••••{MOCK_CASE.account_last4}
          </p>
        </header>

        <Card as="article">
          <StatCallout value={`$${MOCK_CASE.current}`} label={t("case_you_pay")} />
        </Card>
        <Card as="article">
          <Caption>{t("case_looks_wrong")}</Caption>
          <p className="mt-2 leading-relaxed">{pick(MOCK_CASE.issues, lang)}</p>
        </Card>
        <Card as="article">
          <StatCallout value={`$${MOCK_CASE.target}`} label={t("case_good_result")} />
          <p className="mt-3 text-sm leading-relaxed text-muted">{pick(MOCK_CASE.good, lang)}</p>
        </Card>

        <section className="flex flex-col gap-2">
          <label className="font-medium">{t("case_walkaway")}</label>
          <p className="font-display text-3xl">${MOCK_CASE.walkaway}</p>
          <input type="range" min={0} max={MOCK_CASE.current} defaultValue={MOCK_CASE.walkaway} className="w-full" />
        </section>

        <p className="text-xs text-muted">{t("case_consent")}</p>
        <p className="text-xs text-muted">{t("case_simulated_note")}</p>
        <Button href={mockHref(`/${lang}/call/${id}`, true)} size="lg">
          {t("case_start_call")}
        </Button>
      </div>
    );
  }

  let stored: Awaited<ReturnType<typeof loadStoredCase>> = null;
  try {
    stored = await loadStoredCase(id);
  } catch {
    stored = null;
  }

  if (!stored) {
    return (
      <div className="flex flex-col gap-4 px-4 pt-6 pb-8">
        <h1 className="text-3xl">{t("case_title")}</h1>
        <p className="text-muted">{t("case_not_found")}</p>
      </div>
    );
  }

  const { caseFile, explanationI18n, walkawayCents, currentCents, targetCents } = stored;
  const explanation = explanationI18n[lang] ?? explanationI18n.en ?? "";
  const currentDollars = Math.max(Math.round(currentCents / 100), Math.round(walkawayCents / 100));

  return (
    <div className="flex flex-col gap-6 px-4 pt-6 pb-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl">{t("case_title")}</h1>
        {caseFile.provider && (
          <p className="text-muted">
            {caseFile.provider}
            {caseFile.service ? ` · ${caseFile.service}` : ""}
            {caseFile.account_last4 ? ` · ••••${caseFile.account_last4}` : ""}
          </p>
        )}
      </header>

      <Card as="article">
        <StatCallout value={formatMoney(currentCents, lang)} label={t("case_you_pay")} />
      </Card>
      <Card as="article">
        <Caption>{t("case_looks_wrong")}</Caption>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
          {caseFile.issues.length ? (
            caseFile.issues.map((issue) => <li key={issue}>{issue}</li>)
          ) : (
            <li>{explanation || "—"}</li>
          )}
        </ul>
      </Card>
      <Card as="article">
        <StatCallout value={formatMoney(targetCents, lang)} label={t("case_good_result")} />
        {explanation && <p className="mt-3 text-sm leading-relaxed text-muted">{explanation}</p>}
      </Card>

      {caseFile.competitor_offers.length > 0 && (
        <Card as="section">
          <Caption>{t("case_competitors")}</Caption>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            {caseFile.competitor_offers.map((o) => (
              <li key={`${o.provider}-${o.plan}`}>
                {o.provider} · {o.plan} · ${o.monthly.toFixed(0)}/mo
              </li>
            ))}
          </ul>
        </Card>
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
      <p className="text-xs text-muted">{t("case_simulated_note")}</p>
      <StartCallButton
        caseId={id}
        lang={lang}
        label={t("case_start_call")}
        errorLabel={t("intake_error")}
      />
    </div>
  );
}
