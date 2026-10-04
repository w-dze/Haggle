import { getTranslator } from "@/lib/i18n";
import { asLang } from "@/lib/llm";
import { money } from "@/lib/llm/facts";
import { formatDate } from "@/lib/llm/templates";
import { getMerchantHistory } from "@/lib/dashboard";
import { currentUserId } from "@/lib/user";
import { Caption } from "@/components/ui/caption";
import { Card } from "@/components/ui/card";
import { StatCallout } from "@/components/ui/stat-callout";
import { MiniBars } from "@/components/dashboard/mini-bars";
import { StatusChip } from "@/components/dashboard/chips";

export const dynamic = "force-dynamic";

const CADENCE = { weekly: "cadence_weekly", monthly: "cadence_monthly", annual: "cadence_annual", irregular: "cadence_irregular" } as const;
const STATUS = { normal: "status_normal", changed: "status_changed", new: "status_new" } as const;

// One merchant's full charge history, opened from "Your typical charges".
export default async function MerchantHistory({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; slug: string }>;
  searchParams: Promise<{ mock?: string }>;
}) {
  const { lang: rawLang, slug } = await params;
  const mock = (await searchParams).mock === "1";
  const lang = asLang(rawLang);
  const t = getTranslator(lang);
  const data = await getMerchantHistory({ slug, lang, mock, userId: mock ? null : await currentUserId() }).catch(() => null);

  if (!data) {
    return (
      <div className="px-4 pt-6 pb-8">
        <p className="text-muted">{t("merchant_not_found")}</p>
      </div>
    );
  }
  const { merchant: m, charges, findings } = data;

  return (
    <div className="flex flex-col gap-6 px-4 pt-6 pb-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-[34px] leading-tight">{m.display}</h1>
        <p className="flex items-center gap-2 text-muted">
          {t(CADENCE[m.cadence])} <StatusChip status={m.status} label={t(STATUS[m.status])} />
        </p>
      </header>

      <Card className="flex items-end justify-between gap-4 p-5">
        <StatCallout value={money(m.typicalCents)} label={t("typical_label")} />
        <MiniBars monthly={m.monthly} changeMonth={m.changeMonth} label={t("months_chart")} lang={lang} width={132} height={44} />
      </Card>

      {findings.length > 0 && (
        <section className="flex flex-col gap-2">
          <Caption as="h2" index="01">
            {t("dashboard_looks_off")}
          </Caption>
          {findings.map((f) => (
            <p key={f.id} className="leading-relaxed">
              {f.summary}
            </p>
          ))}
        </section>
      )}

      <section aria-labelledby="hist" className="flex flex-col gap-3">
        <Caption as="h2" index={findings.length ? "02" : "01"} id="hist">
          {t("merchant_history")}
        </Caption>
        <table className="w-full overflow-hidden rounded-2xl border border-line bg-surface text-left text-sm tabular-nums">
          <thead className="text-[11px] uppercase tracking-[0.12em] text-muted">
            <tr className="border-b border-line">
              <th scope="col" className="px-4 py-2 font-medium">{t("col_date")}</th>
              <th scope="col" className="px-4 py-2 text-right font-medium">{t("col_amount")}</th>
            </tr>
          </thead>
          <tbody>
            {charges.map((c) => (
              <tr key={c.id} className="border-b border-line last:border-0">
                <td className="px-4 py-2.5">
                  {formatDate(c.date, lang)}
                  {c.duplicate && <span className="ml-2 text-xs text-accent">· {t("duplicate_tag")}</span>}
                </td>
                <td className="px-4 py-2.5 text-right">{money(c.amountCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
