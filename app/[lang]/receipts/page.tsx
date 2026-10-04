import Link from "next/link";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { getTranslator } from "@/lib/i18n";
import { asLang } from "@/lib/llm";
import { money } from "@/lib/llm/facts";
import { formatDate } from "@/lib/llm/templates";
import { MOCK_OUTCOME, mockHref } from "@/lib/mock-call";
import { currentUserId } from "@/lib/user";
import { Card } from "@/components/ui/card";
import { StatCallout } from "@/components/ui/stat-callout";

export const dynamic = "force-dynamic";

type Receipt = {
  callId: string;
  provider: string;
  oldCents: number | null;
  newCents: number | null;
  annualCents: number | null;
  confirmation: string | null;
  date: string | null;
};

async function loadReceipts(userId: string): Promise<Receipt[]> {
  const { getDb } = await import("@/lib/db/client");
  const { calls, caseFiles, outcomes } = await import("@/lib/db/schema");
  const db = getDb();
  const cases = await db
    .select({ id: caseFiles.id, explanation: caseFiles.explanationI18n })
    .from(caseFiles)
    .where(and(eq(caseFiles.userId, userId), isNotNull(caseFiles.findingId)));
  if (!cases.length) return [];
  const callRows = await db.select().from(calls).where(inArray(calls.caseFileId, cases.map((c) => c.id)));
  if (!callRows.length) return [];
  const outs = await db.select().from(outcomes).where(inArray(outcomes.callId, callRows.map((c) => c.id)));
  const provider = new Map(
    cases.map((c) => [c.id, ((c.explanation ?? {}) as { case_file?: { provider?: string } }).case_file?.provider ?? ""]),
  );
  return outs.map((o) => {
    const call = callRows.find((c) => c.id === o.callId)!;
    return {
      callId: call.id,
      provider: provider.get(call.caseFileId ?? "") ?? "",
      oldCents: o.oldCents,
      newCents: o.newCents,
      annualCents: o.annualSavingsCents,
      confirmation: o.confirmationRef,
      date: (call.endedAt ?? call.startedAt)?.toISOString().slice(0, 10) ?? null,
    };
  });
}

// Finished calls that started from the bill check-up.
export default async function Receipts({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ mock?: string }>;
}) {
  const lang = asLang((await params).lang);
  const mock = (await searchParams).mock === "1";
  const t = getTranslator(lang);

  let receipts: Receipt[] = [];
  if (mock) {
    receipts = [
      {
        callId: "demo",
        provider: "Northwind Internet",
        oldCents: MOCK_OUTCOME.old * 100,
        newCents: MOCK_OUTCOME.new * 100,
        annualCents: (MOCK_OUTCOME.old - MOCK_OUTCOME.new) * 1200,
        confirmation: null,
        date: null,
      },
    ];
  } else {
    const userId = await currentUserId();
    receipts = userId ? await loadReceipts(userId).catch(() => []) : [];
  }

  return (
    <div className="flex flex-col gap-6 px-4 pt-6 pb-8">
      <h1 className="text-3xl">{t("receipts_title")}</h1>
      {mock && <p className="text-sm text-muted">{t("receipts_demo_note")}</p>}
      {receipts.length === 0 ? (
        <p className="text-muted">{t("receipts_empty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {receipts.map((r) => (
            <li key={r.callId}>
              <Link href={mockHref(`/${lang}/debrief/${r.callId}`, mock)} className="block rounded-2xl focus-visible:outline-2 focus-visible:outline-foreground">
                <Card className="flex flex-col gap-3 border-dashed p-5 hover:bg-foreground/5">
                  <p className="font-semibold">{r.provider}</p>
                  {r.annualCents ? <StatCallout value={money(r.annualCents)} label={t("receipts_saved")} tone="success" /> : null}
                  <p className="text-sm tabular-nums text-muted">
                    {r.oldCents !== null && r.newCents !== null ? `${money(r.oldCents)} → ${money(r.newCents)} ${t("per_month")}` : ""}
                    {r.confirmation ? ` · ${r.confirmation}` : ""}
                    {r.date ? ` · ${formatDate(r.date, lang)}` : ""}
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
