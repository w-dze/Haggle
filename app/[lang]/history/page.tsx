import Link from "next/link";
import { desc } from "drizzle-orm";
import { getTranslator } from "@/lib/i18n";
import { getDb } from "@/lib/db/client";
import { calls, outcomes } from "@/lib/db/schema";
import { formatMoney } from "@/lib/money";
import { MOCK_OUTCOME, mockHref } from "@/lib/mock-call";
import { Card } from "@/components/ui/card";

export default async function History({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ mock?: string }>;
}) {
  const { lang } = await params;
  const mock = (await searchParams).mock === "1";
  const t = getTranslator(lang);

  if (mock) {
    const annual = (MOCK_OUTCOME.old - MOCK_OUTCOME.new) * 12;
    return (
      <div className="flex flex-col gap-6 px-4 pt-6 pb-8">
        <h1 className="text-3xl">{t("history_title")}</h1>
        <Link href={mockHref(`/${lang}/debrief/demo`, true)}>
          <Card className="hover:bg-foreground/5">
            <p className="font-medium">{MOCK_OUTCOME.result}</p>
            <p className="text-sm text-muted">
              Northwind · ${MOCK_OUTCOME.old} → ${MOCK_OUTCOME.new} · ${annual}/yr
            </p>
          </Card>
        </Link>
      </div>
    );
  }

  let rows: { id: string; status: string | null; startedAt: Date | null; savings: number | null; result: string | null }[] =
    [];
  try {
    const db = getDb();
    const callRows = await db.select().from(calls).orderBy(desc(calls.startedAt)).limit(20);
    const outRows = await db.select().from(outcomes);
    const byCall = new Map(outRows.map((o) => [o.callId, o]));
    rows = callRows.map((c) => ({
      id: c.id,
      status: c.status,
      startedAt: c.startedAt,
      savings: byCall.get(c.id)?.annualSavingsCents ?? null,
      result: byCall.get(c.id)?.result ?? null,
    }));
  } catch {
    rows = [];
  }

  return (
    <div className="flex flex-col gap-6 px-4 pt-6 pb-8">
      <h1 className="text-3xl">{t("history_title")}</h1>
      {rows.length === 0 ? (
        <p className="text-muted">—</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/${lang}/debrief/${r.id}`}>
                <Card className="hover:bg-foreground/5">
                  <p className="font-medium">{r.result ?? r.status}</p>
                  <p className="text-sm text-muted">
                    {r.startedAt ? r.startedAt.toLocaleString() : ""}
                    {r.savings ? ` · ${formatMoney(r.savings, lang)}` : ""}
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
