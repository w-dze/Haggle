import { and, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { env } from "@/lib/env";
import { currentDetection, type Detection } from "@/lib/checkup/findings";
import { callKind, findingSummary, resolvedSummary } from "@/lib/checkup/summaries";
import { summarizeFindings } from "@/lib/detect/index";
import type { Dismissal, Finding, MerchantSummary } from "@/lib/detect/types";
import { asLang } from "@/lib/llm";
import type { DataSource } from "@/lib/data-source";

// View model for the bill check-up dashboard. Everything numeric comes from
// the detector; this only filters, labels and persists per-user state.

export type EvidenceCharge = { id: string; date: string; amountCents: number; duplicate: boolean };
export type EvidenceEmail = {
  provider: string;
  newAmountCents: number | null;
  previousAmountCents: number | null;
  effectiveDate: string | null;
  messageId: string;
};

export type FindingView = {
  id: string;
  type: Finding["type"];
  merchant: string;
  display: string;
  category: string;
  confidence: Finding["confidence"];
  reasons: Finding["reasons"];
  summary: string;
  beforeCents: number | null;
  afterCents: number;
  extraPaidCents: number;
  changeDate: string;
  latestDate: string;
  status: "open" | "called";
  callKind: "price" | "refund" | "cancel";
  evidence: { charges: EvidenceCharge[]; email: EvidenceEmail | null };
};

export type MerchantView = Omit<MerchantSummary, "status"> & {
  status: MerchantSummary["status"] | "resolved";
  changeMonth: string | null;
};

/** A finding whose call ended in a deal. */
export type ResolvedView = {
  findingId: string;
  merchant: string;
  display: string;
  summary: string;
  oldCents: number;
  newCents: number;
  annualCents: number;
  confirmation: string | null;
  date: string | null;
  callId: string;
};

export type DashboardData =
  | {
      ok: true;
      source: DataSource;
      sourceReason: string;
      inboxOff: boolean;
      asOf: string;
      summary: ReturnType<typeof summarizeFindings> & { savedAnnualCents: number };
      lookingOff: FindingView[];
      resolved: ResolvedView[];
      probablyFine: FindingView[];
      merchants: MerchantView[];
    }
  | { ok: false; error: string };

async function loadUserState(userId: string | null): Promise<{ dismissals: Dismissal[]; called: Set<string> }> {
  if (!userId || !env.DATABASE_URL) return { dismissals: [], called: new Set() };
  try {
    const { getDb } = await import("@/lib/db/client");
    const { dismissals, findings } = await import("@/lib/db/schema");
    const db = getDb();
    const [dRows, fRows] = await Promise.all([
      db
        .select()
        .from(dismissals)
        .where(and(eq(dismissals.userId, userId), isNull(dismissals.undoneAt))),
      db.select({ id: findings.id, status: findings.status }).from(findings).where(eq(findings.userId, userId)),
    ]);
    return {
      dismissals: dRows.map((d) => ({ findingId: d.findingId, merchant: d.merchant, acceptedAmountCents: d.acceptedAmountCents })),
      called: new Set(fRows.filter((f) => f.status === "called").map((f) => f.id)),
    };
  } catch (err) {
    console.warn(`[dashboard] user state unavailable: ${err instanceof Error ? err.message : err}`);
    return { dismissals: [], called: new Set() };
  }
}

/** Record the current findings for this user (keeps each row's status). */
async function persistFindings(userId: string, list: Finding[]) {
  if (!env.DATABASE_URL || !list.length) return;
  try {
    const { getDb } = await import("@/lib/db/client");
    const { findings } = await import("@/lib/db/schema");
    await getDb()
      .insert(findings)
      .values(
        list.map((f) => ({
          id: f.id,
          userId,
          type: f.type,
          merchant: f.merchant,
          data: f,
          confidence: f.confidence,
        })),
      )
      .onConflictDoUpdate({
        target: [findings.userId, findings.id],
        set: { data: sql`excluded.data`, confidence: sql`excluded.confidence`, updatedAt: sql`now()` },
      });
  } catch (err) {
    console.warn(`[dashboard] could not store findings: ${err instanceof Error ? err.message : err}`);
  }
}

export function toView(f: Finding, det: Detection, lang: string, called: Set<string>): FindingView {
  const dupSet = new Set<string>();
  if (f.type === "duplicate") dupSet.add(f.evidence.chargeIds[f.evidence.chargeIds.length - 1]);
  const ev = det.billEvents.find((e) => f.evidence.emailIds.includes(e.sourceMessageId));
  return {
    id: f.id,
    type: f.type,
    merchant: f.merchant,
    display: f.display,
    category: f.category,
    confidence: f.confidence,
    reasons: f.reasons,
    summary: findingSummary(f, asLang(lang)),
    beforeCents: f.beforeCents,
    afterCents: f.afterCents,
    extraPaidCents: f.extraPaidCents,
    changeDate: f.changeDate,
    latestDate: f.latestDate,
    status: called.has(f.id) ? "called" : "open",
    callKind: callKind(f.type),
    evidence: {
      charges: f.evidence.chargeIds
        .map((id) => det.charges.get(id))
        .filter((c): c is NonNullable<typeof c> => Boolean(c))
        .map((c) => ({ id: c.id, date: c.date, amountCents: c.amountCents, duplicate: dupSet.has(c.id) }))
        .sort((x, y) => x.date.localeCompare(y.date)),
      email: ev
        ? {
            provider: ev.provider ?? "",
            newAmountCents: ev.amountCents,
            previousAmountCents: ev.previousAmountCents,
            effectiveDate: ev.effectiveDate,
            messageId: ev.sourceMessageId,
          }
        : null,
    },
  };
}

/** Calls started from this user's findings that ended in an agreed deal (latest per finding). */
async function loadResolved(userId: string | null, lang: string): Promise<ResolvedView[]> {
  if (!userId || !env.DATABASE_URL) return [];
  try {
    const { getDb } = await import("@/lib/db/client");
    const { calls, caseFiles, outcomes } = await import("@/lib/db/schema");
    const db = getDb();
    const cases = await db
      .select({ id: caseFiles.id, findingId: caseFiles.findingId, explanation: caseFiles.explanationI18n })
      .from(caseFiles)
      .where(and(eq(caseFiles.userId, userId), isNotNull(caseFiles.findingId)));
    if (!cases.length) return [];
    const callRows = await db.select().from(calls).where(inArray(calls.caseFileId, cases.map((c) => c.id)));
    if (!callRows.length) return [];
    const outs = await db
      .select()
      .from(outcomes)
      .where(and(inArray(outcomes.callId, callRows.map((c) => c.id)), eq(outcomes.result, "agreed")))
      .orderBy(desc(outcomes.id));
    const byFinding = new Map<string, ResolvedView>();
    for (const o of outs) {
      const call = callRows.find((c) => c.id === o.callId);
      const kase = cases.find((c) => c.id === call?.caseFileId);
      if (!call || !kase?.findingId || byFinding.has(kase.findingId)) continue;
      if (o.oldCents === null || o.newCents === null) continue;
      const cf = ((kase.explanation ?? {}) as { case_file?: { provider?: string } }).case_file;
      const annual = o.annualSavingsCents ?? (o.oldCents - o.newCents) * 12;
      byFinding.set(kase.findingId, {
        findingId: kase.findingId,
        merchant: "",
        display: cf?.provider ?? "",
        summary: resolvedSummary(asLang(lang), { oldCents: o.oldCents, newCents: o.newCents, annualCents: annual }),
        oldCents: o.oldCents,
        newCents: o.newCents,
        annualCents: annual,
        confirmation: o.confirmationRef,
        date: (call.endedAt ?? call.startedAt)?.toISOString().slice(0, 10) ?? null,
        callId: call.id,
      });
    }
    return [...byFinding.values()];
  } catch (err) {
    console.warn(`[dashboard] resolved calls unavailable: ${err instanceof Error ? err.message : err}`);
    return [];
  }
}

export async function getDashboard(opts: {
  lang: string;
  mock: boolean;
  userId: string | null;
  inboxOff: boolean;
}): Promise<DashboardData> {
  try {
    const state = opts.mock ? { dismissals: [], called: new Set<string>() } : await loadUserState(opts.userId);
    const det = await currentDetection({ mock: opts.mock, dismissals: state.dismissals, inboxOff: opts.inboxOff });
    if (!opts.mock && opts.userId) await persistFindings(opts.userId, det.findings);

    // Resolved calls are looked up even in demo mode, for this browser's user id.
    const resolved = await loadResolved(opts.userId, opts.lang);
    const resolvedIds = new Set(resolved.map((r) => r.findingId));
    for (const r of resolved) r.merchant = det.findings.find((f) => f.id === r.findingId)?.merchant ?? "";
    const open = det.findings.filter((f) => !resolvedIds.has(f.id));

    const views = open.map((f) => toView(f, det, opts.lang, state.called));
    const changeMonth = new Map<string, string>();
    for (const f of open.filter((x) => x.confidence !== "low")) changeMonth.set(f.merchant, f.changeDate.slice(0, 7));
    const resolvedMerchants = new Set(resolved.map((r) => r.merchant));

    return {
      ok: true,
      source: det.source,
      sourceReason: det.sourceReason,
      inboxOff: opts.inboxOff,
      asOf: det.asOf,
      summary: { ...summarizeFindings(open), savedAnnualCents: resolved.reduce((s, r) => s + r.annualCents, 0) },
      lookingOff: views.filter((v) => v.confidence !== "low"),
      probablyFine: views.filter((v) => v.confidence === "low"),
      resolved,
      merchants: det.merchants.map((m) => ({
        ...m,
        status: resolvedMerchants.has(m.merchant) && !changeMonth.has(m.merchant) ? ("resolved" as const) : m.status,
        changeMonth: changeMonth.get(m.merchant) ?? null,
      })),
    };
  } catch (err) {
    console.error(`[dashboard] failed: ${err instanceof Error ? err.stack : err}`);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function getMerchantHistory(opts: {
  slug: string;
  lang: string;
  mock: boolean;
  userId: string | null;
}) {
  const state = opts.mock ? { dismissals: [], called: new Set<string>() } : await loadUserState(opts.userId);
  const det = await currentDetection({ mock: opts.mock, dismissals: state.dismissals });
  const merchant = det.merchants.find((m) => m.merchant === opts.slug);
  if (!merchant) return null;
  const findings = det.findings.filter((f) => f.merchant === opts.slug).map((f) => toView(f, det, opts.lang, state.called));
  const dupIds = new Set(findings.flatMap((f) => f.evidence.charges.filter((c) => c.duplicate).map((c) => c.id)));
  const charges = merchant.chargeIds
    .map((id) => det.charges.get(id)!)
    .filter(Boolean)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((c) => ({ ...c, duplicate: dupIds.has(c.id) }));
  const changeMonth = findings.find((f) => f.confidence !== "low")?.changeDate.slice(0, 7) ?? null;
  return { merchant: { ...merchant, changeMonth }, charges, findings, source: det.source };
}
