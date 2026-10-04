import { getTranslator } from "@/lib/i18n";
import { asLang } from "@/lib/llm";
import { mockHref } from "@/lib/mock-call";
import { getDashboard } from "@/lib/dashboard";
import { currentUserId, inboxDisconnected } from "@/lib/user";
import { Button } from "@/components/ui/button";
import { Caption } from "@/components/ui/caption";
import { Card } from "@/components/ui/card";
import { CheckupFindings } from "@/components/dashboard/checkup-findings";
import { ChargeRow } from "@/components/dashboard/charge-row";
import { ResolvedList } from "@/components/dashboard/resolved-list";
import { CheckupFooter } from "@/components/dashboard/checkup-footer";

export const dynamic = "force-dynamic";

// Bill check-up: the app's home once a language is chosen. Shows what looks
// off (from lib/detect) and the user's typical recurring charges.
export default async function Dashboard({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ mock?: string; inbox?: string }>;
}) {
  const { lang: rawLang } = await params;
  const sp = await searchParams;
  const mock = sp.mock === "1";
  const lang = asLang(rawLang);
  const t = getTranslator(lang);
  const inboxOff = mock ? sp.inbox === "off" : await inboxDisconnected();
  // The user id is passed in mock mode too, but only to show this browser's resolved calls.
  const data = await getDashboard({ lang, mock, userId: await currentUserId(), inboxOff });
  const TOP = 4;

  return (
    <div className="flex flex-col gap-5 px-4 pt-5 pb-8">
      <h1 className="text-[28px] leading-tight">{t("dashboard_title")}</h1>

      {data.ok ? (
        <>
          <CheckupFindings
            lang={lang}
            mock={mock}
            lookingOff={data.lookingOff}
            probablyFine={data.probablyFine}
            savedAnnualCents={data.summary.savedAnnualCents}
          />

          {data.resolved.length > 0 && (
            <ResolvedList items={data.resolved} lang={lang} mock={mock} index={data.lookingOff.length ? "02" : "01"} />
          )}

          <section aria-labelledby="typical" className="flex flex-col gap-2.5">
            <Caption as="h2" index={String([data.lookingOff.length > 0, data.resolved.length > 0].filter(Boolean).length + 1).padStart(2, "0")} id="typical">
              {t("dashboard_typical")}
            </Caption>
            {data.merchants.length ? (
              <div className="overflow-hidden rounded-2xl border border-line bg-surface">
                <ul className="divide-y divide-line">
                  {data.merchants.slice(0, TOP).map((m) => (
                    <ChargeRow key={m.merchant} m={m} lang={lang} mock={mock} />
                  ))}
                </ul>
                {data.merchants.length > TOP && (
                  <details className="group border-t border-line">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-center gap-2 text-sm font-medium text-muted hover:text-foreground group-open:hidden">
                      {t("dashboard_show_all")} ({data.merchants.length}) <span aria-hidden="true">▾</span>
                    </summary>
                    <ul className="divide-y divide-line">
                      {data.merchants.slice(TOP).map((m) => (
                        <ChargeRow key={m.merchant} m={m} lang={lang} mock={mock} />
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            ) : (
              <p className="text-muted">{t("dashboard_empty_typical")}</p>
            )}
          </section>
        </>
      ) : (
        <Card className="flex flex-col items-start gap-3">
          <p role="alert">{t("dashboard_error")}</p>
          <Button href={mockHref(`/${lang}/dashboard`, mock)} variant="secondary">
            {t("dashboard_retry")}
          </Button>
        </Card>
      )}

      <CheckupFooter lang={lang} mock={mock} inboxOff={data.ok ? data.inboxOff : inboxOff} source={data.ok ? data.source : "fixture"} />
    </div>
  );
}
