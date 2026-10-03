import Link from "next/link";
import { desc } from "drizzle-orm";
import { getTranslator } from "@/lib/i18n";
import { getDb } from "@/lib/db/client";
import { calls, outcomes } from "@/lib/db/schema";
import { formatMoney } from "@/lib/money";

export default async function History({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const t = getTranslator(lang);

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
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t("history_title")}</h1>
      {rows.length === 0 ? (
        <p className="text-muted">—</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/${lang}/debrief/${r.id}`}
                className="block rounded-xl border border-foreground/10 p-4 hover:bg-foreground/5"
              >
                <p className="font-medium">{r.result ?? r.status}</p>
                <p className="text-sm text-muted">
                  {r.startedAt ? r.startedAt.toLocaleString() : ""}
                  {r.savings ? ` · ${formatMoney(r.savings, lang)}` : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
