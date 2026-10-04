import { desc, eq, inArray, or } from "drizzle-orm";
import { getMessages, getTranslator } from "@/lib/i18n";
import { asLang } from "@/lib/llm";
import { currentUserId } from "@/lib/user";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type Row = { id: number; ts: Date; event: string; detail: string };

async function loadEvents(userId: string): Promise<Row[]> {
  const { getDb } = await import("@/lib/db/client");
  const { approvals, auditEvents, calls, caseFiles } = await import("@/lib/db/schema");
  const db = getDb();
  const cases = await db.select({ id: caseFiles.id }).from(caseFiles).where(eq(caseFiles.userId, userId));
  const caseIds = cases.map((c) => c.id);
  // Call events (connected, approvals, ended) are keyed by call id, not case id.
  const callIds = caseIds.length
    ? (await db.select({ id: calls.id }).from(calls).where(inArray(calls.caseFileId, caseIds))).map((c) => c.id)
    : [];
  const mine = [
    eq(auditEvents.userId, userId),
    ...(caseIds.length ? [inArray(auditEvents.caseFileId, caseIds)] : []),
    ...(callIds.length ? [inArray(auditEvents.callId, callIds)] : []),
  ];
  const rows = await db
    .select()
    .from(auditEvents)
    .where(or(...mine))
    .orderBy(desc(auditEvents.id))
    .limit(100);
  const events: Row[] = rows.map((r) => {
    const p = (r.payload ?? {}) as Record<string, unknown>;
    const detail = [p.merchant, p.lang, p.source, p.kind, p.decision].filter((v) => typeof v === "string").join(" · ");
    return { id: r.id, ts: r.ts, event: r.event, detail };
  });
  // Approvals carry their own request/answer timestamps (the approvals route
  // doesn't write audit rows yet), so read them from the approvals table.
  if (callIds.length) {
    const appr = await db.select().from(approvals).where(inArray(approvals.callId, callIds));
    for (const a of appr) {
      const offer = (a.offer ?? {}) as { monthly?: number };
      const amount = typeof offer.monthly === "number" ? `$${offer.monthly}` : "";
      events.push({ id: -events.length - 1, ts: a.requestedAt, event: "approval.requested", detail: amount });
      if (a.answeredAt) events.push({ id: -events.length - 1, ts: a.answeredAt, event: "approval.answered", detail: a.status ?? "" });
    }
  }
  return events.sort((x, y) => y.ts.getTime() - x.ts.getTime()).slice(0, 100);
}

// This user's activity: every explain, dismiss, call start and approval, with
// timestamps. Read-only view of the append-only audit_events table.
export default async function AuditLog({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ mock?: string }>;
}) {
  const lang = asLang((await params).lang);
  const mock = (await searchParams).mock === "1";
  const t = getTranslator(lang);
  const messages = getMessages(lang) as Record<string, string>;
  const userId = mock ? null : await currentUserId();
  const rows = userId ? await loadEvents(userId).catch(() => []) : [];
  const fmt = new Intl.DateTimeFormat(lang, { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="flex flex-col gap-6 px-4 pt-6 pb-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl">{t("audit_title")}</h1>
        <p className="text-sm text-muted">{mock ? t("audit_demo_note") : t("audit_note")}</p>
      </header>
      {rows.length === 0 ? (
        <p className="text-muted">{t("audit_empty")}</p>
      ) : (
        <Card className="p-0">
          <ol className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-col gap-0.5 px-4 py-3">
                <span className="font-medium">{messages[`event_${r.event}`] ?? r.event}</span>
                <span className="text-xs text-muted">
                  <time dateTime={r.ts.toISOString()}>{fmt.format(r.ts)}</time>
                  {r.detail ? ` · ${r.detail}` : ""}
                </span>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}
