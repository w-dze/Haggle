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
import { demoBillEvents, findingById } from "@/lib/checkup/findings";
import { buildCaseFromFinding } from "@/lib/checkup/case-from-finding";

// Shown on cases created from a bill check-up finding ("Call about this").
function CheckupNote({ label, phoneLabel, phone }: { label: string; phoneLabel: string; phone: string | null }) {
  return (
    <div className="flex flex-col gap-1">
      <Caption>{label}</Caption>
      {phone && (
        <p className="text-sm text-muted">
          {phoneLabel}: <span className="whitespace-nowrap tabular-nums text-foreground">{phone}</span>
        </p>
      )}
    </div>
  );
}

function pick(text: { en: string; es: string; zh: string; ko: string }, lang: string) {
  return text[lang as keyof typeof text] ?? text.en;
}

export default async function CasePage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; id: string }>;
  searchParams: Promise<{ mock?: string; from?: string; finding?: string }>;
}) {
  const { lang, id } = await params;
  const sp = await searchParams;
  const mock = sp.mock === "1";
  const fromCheckup = sp.from === "checkup";
  const t = getTranslator(lang);

  // Demo mode, a check-up finding other than Northwind: show the pre-filled
  // case from the fixture. The scripted demo call only covers Northwind.
  if (mock && sp.finding) {
    const finding = await findingById(sp.finding, { mock: true });
    if (finding) {
      const built = buildCaseFromFinding(finding, demoBillEvents(), lang);
      const summary = built.summaries[lang as keyof typeof built.summaries] ?? built.summaries.en;
      return (
        <div className="flex flex-col gap-6 px-4 pt-6 pb-8">
          <header className="flex flex-col gap-2">
            <h1 className="text-3xl">{t("case_title")}</h1>
            <p className="text-muted">
              {built.caseFile.provider} · {built.caseFile.service} · ••••{built.caseFile.account_last4}
            </p>
            <CheckupNote label={t("case_from_checkup")} phoneLabel={t("case_verified_phone")} phone={built.phone} />
          </header>
          <Card as="article">
            <StatCallout value={formatMoney(built.currentCents, lang)} label={t("case_you_pay")} />
          </Card>
          <Card as="article">
            <Caption>{t("case_looks_wrong")}</Caption>
            <p className="mt-2 leading-relaxed">{summary}</p>
          </Card>
          {built.kind === "price" && (
            <Card as="article">
              <StatCallout value={formatMoney(built.targetCents, lang)} label={t("case_good_result")} />
            </Card>
          )}
          {built.kind !== "price" && <p className="text-sm text-muted">{t("case_checkup_nonprice_note")}</p>}
          <p className="text-sm text-muted">{t("case_mock_northwind_only")}</p>
        </div>
      );
    }
  }

  if (mock) {
    return (
      <div className="flex flex-col gap-6 px-4 pt-6 pb-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl">{t("case_title")}</h1>
          <p className="text-muted">
            {MOCK_CASE.provider} · {MOCK_CASE.service} · ••••{MOCK_CASE.account_last4}
          </p>
          {fromCheckup && (
            <CheckupNote label={t("case_from_checkup")} phoneLabel={t("case_verified_phone")} phone="+1-800-555-0142" />
          )}
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

        <WalkawaySlider
          caseId={id}
          lang={lang}
          initialCents={MOCK_CASE.walkaway * 100}
          maxDollars={MOCK_CASE.current}
          label={t("case_walkaway")}
          savedLabel={t("case_walkaway_saved")}
          persist={false}
        />

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

  const { caseFile, explanationI18n, walkawayCents, currentCents, targetCents, checkup } = stored;
  const explanation = explanationI18n[lang] ?? explanationI18n.en ?? "";
  // Check-up cases: show the finding summary in the user's language.
  const issues = checkup ? [explanation] : caseFile.issues;
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
        {checkup && <CheckupNote label={t("case_from_checkup")} phoneLabel={t("case_verified_phone")} phone={checkup.phone} />}
      </header>

      <Card as="article">
        <StatCallout value={formatMoney(currentCents, lang)} label={t("case_you_pay")} />
      </Card>
      <Card as="article">
        <Caption>{t("case_looks_wrong")}</Caption>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
          {issues.length ? (
            issues.map((issue) => <li key={issue}>{issue}</li>)
          ) : (
            <li>{explanation || "—"}</li>
          )}
        </ul>
      </Card>
      <Card as="article">
        <StatCallout value={formatMoney(targetCents, lang)} label={t("case_good_result")} />
        {explanation && !checkup && <p className="mt-3 text-sm leading-relaxed text-muted">{explanation}</p>}
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
      {checkup && checkup.kind !== "price" ? (
        <p className="text-sm text-muted">{t("case_checkup_nonprice_note")}</p>
      ) : (
        <>
          <p className="text-xs text-muted">{t("case_simulated_note")}</p>
          <StartCallButton
            caseId={id}
            lang={lang}
            label={t("case_start_call")}
            errorLabel={t("intake_error")}
          />
        </>
      )}
      <StartCallButton
        caseId={id}
        lang={lang}
        mode="live"
        variant="secondary"
        label={t("case_start_live")}
        errorLabel={t("intake_error")}
      />
    </div>
  );
}
