import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { approvals, calls, outcomes, transcriptLines } from "@/lib/db/schema";
import { requireEnv } from "@/lib/env";
import { writeAudit } from "@/lib/audit";
import { loadStoredCase } from "@/lib/case-files";
import { dollarsToCents } from "@/lib/money";
import { translateLine } from "@/lib/gemini/translate";
import type { CaseFile, Debrief } from "@/lib/schemas";

// Live browser negotiation: the ElevenLabs agent runs in the user's browser
// (someone at the laptop plays the provider rep). The browser forwards each
// finished turn and the approval tool call here; the SSE stream does the rest.

const APPROVAL_MS = 45_000;
const POLL_MS = 750;

const list = (items: string[]) => (items.length ? items.map((i) => `- ${i}`).join("\n") : "none");

export function dynamicVariables(cf: CaseFile, callId: string): Record<string, string> {
  return {
    call_id: callId,
    holder_name: cf.account_holder_name || "the account holder",
    provider: cf.provider,
    service: cf.service,
    account_last4: cf.account_last4,
    current_monthly: String(cf.current_monthly),
    target_monthly: String(cf.target_monthly),
    walkaway_monthly: String(cf.walkaway_monthly),
    issues: list(cf.issues),
    leverage: list(cf.leverage),
    competitor_offers: list(cf.competitor_offers.map((o) => `${o.provider}: $${o.monthly}/mo`)),
    allowed_concessions: list(cf.allowed_concessions),
    forbidden: list(cf.forbidden),
  };
}

async function translateOrEnglish(textEn: string, context: string[], lang: string) {
  if (lang === "en") return { text: textEn, numbersOk: true };
  try {
    return await translateLine({ textEn, context, targetLang: lang });
  } catch {
    // Gemini quota/outage: keep the call going with English subtitles.
    return { text: textEn, numbersOk: true };
  }
}

export async function startLiveSession(callId: string) {
  const db = getDb();
  const [call] = await db.select().from(calls).where(eq(calls.id, callId)).limit(1);
  if (!call?.caseFileId) return null;
  const stored = await loadStoredCase(call.caseFileId);
  if (!stored) return null;

  const agentId = requireEnv("ELEVENLABS_AGENT_ID");
  const res = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`,
    { headers: { "xi-api-key": requireEnv("ELEVENLABS_API_KEY") } },
  );
  if (!res.ok) throw new Error(`ElevenLabs signed-url ${res.status}: ${await res.text()}`);
  const { signed_url } = (await res.json()) as { signed_url: string };

  return { signedUrl: signed_url, dynamicVariables: dynamicVariables(stored.caseFile, callId) };
}

export async function markLive(callId: string, conversationId: string) {
  const db = getDb();
  await db
    .update(calls)
    .set({ status: "live", elConversationId: conversationId, transcriptSource: "realtime" })
    .where(eq(calls.id, callId));
  await writeAudit({ actor: "negotiator", event: "call.live", callId, payload: { mode: "live" } });
}

export async function ingestLiveTurn(
  callId: string,
  speaker: "agent" | "rep",
  textEn: string,
  lang: string,
) {
  const db = getDb();
  const prev = await db
    .select({ seq: transcriptLines.seq, textEn: transcriptLines.textEn })
    .from(transcriptLines)
    .where(eq(transcriptLines.callId, callId))
    .orderBy(desc(transcriptLines.seq))
    .limit(3);
  const context = prev.map((p) => p.textEn ?? "").reverse();
  const { text, numbersOk } = await translateOrEnglish(textEn, context, lang);

  await db.insert(transcriptLines).values({
    callId,
    seq: (prev[0]?.seq ?? 0) + 1,
    speaker,
    textEn,
    textTranslated: text,
    lang,
    numbersOk,
    source: "realtime",
  });
}

/** Inserts a pending approval and waits for the user's answer (no answer = no). */
export async function requestLiveApproval(input: {
  callId: string;
  summary: string;
  monthlyPrice: number;
  lang: string;
}): Promise<{ approved: boolean; reason: string }> {
  const db = getDb();
  const { text } = await translateOrEnglish(input.summary, [], input.lang);
  const [row] = await db
    .insert(approvals)
    .values({
      callId: input.callId,
      summaryEn: input.summary,
      summaryTranslated: text,
      offer: { monthly: input.monthlyPrice },
      status: "pending",
    })
    .returning({ id: approvals.id });

  const deadline = Date.now() + APPROVAL_MS;
  while (Date.now() < deadline) {
    const [current] = await db
      .select({ status: approvals.status })
      .from(approvals)
      .where(eq(approvals.id, row.id))
      .limit(1);
    if (current && current.status !== "pending") {
      return { approved: current.status === "yes", reason: current.status ?? "unknown" };
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  await db.update(approvals).set({ status: "timeout" }).where(eq(approvals.id, row.id));
  return { approved: false, reason: "timeout" };
}

function liveDebrief(lang: string, oldM: number, newM: number, confirm: string | null): Debrief {
  const monthly = Math.max(0, oldM - newM);
  const annual = monthly * 12;
  const ref = confirm ?? "";
  const prose: Record<string, string> = {
    es: `Acuerdo: de $${oldM} a $${newM} al mes (ahorras $${monthly}/mes, $${annual} al año).${ref ? ` Confirmación ${ref}.` : ""}`,
    zh: `已谈成：月费从 $${oldM} 降到 $${newM}（每月省 $${monthly}，每年约 $${annual}）。${ref ? `确认号 ${ref}。` : ""}`,
    ko: `합의: 월 $${oldM}에서 $${newM}로 낮아졌습니다 (매달 $${monthly}, 연 $${annual} 절약).${ref ? ` 확인 번호 ${ref}.` : ""}`,
    en: `Deal: $${oldM} down to $${newM} a month (save $${monthly}/mo, $${annual}/yr).${ref ? ` Confirmation ${ref}.` : ""}`,
  };
  const next: Record<string, string[]> = {
    es: ["Revisa la próxima factura."],
    zh: ["核对下一期账单。"],
    ko: ["다음 청구서를 확인하세요."],
    en: ["Check the next bill."],
  };
  return {
    result: "agreed",
    old_monthly: oldM,
    new_monthly: newM,
    monthly_savings: monthly,
    annual_savings: annual,
    agreed_terms: [`$${newM}/mo`, ...(ref ? [`confirmation ${ref}`] : [])],
    next_steps: next[lang] ?? next.en,
    confirmation_ref: ref || undefined,
    prose: prose[lang] ?? prose.en,
  };
}

/** Ends the call; records an outcome if the user approved an offer during it. */
export async function finishLiveCall(callId: string, lang: string) {
  const db = getDb();
  const [call] = await db.select().from(calls).where(eq(calls.id, callId)).limit(1);
  if (!call?.caseFileId || ["ended", "failed", "killed"].includes(call.status ?? "")) return;

  const [approved] = await db
    .select()
    .from(approvals)
    .where(and(eq(approvals.callId, callId), eq(approvals.status, "yes")))
    .orderBy(desc(approvals.requestedAt))
    .limit(1);
  const newMonthly = Number((approved?.offer as { monthly?: number } | null)?.monthly);
  const stored = await loadStoredCase(call.caseFileId);

  if (approved && stored && Number.isFinite(newMonthly)) {
    const repLines = await db
      .select({ textEn: transcriptLines.textEn })
      .from(transcriptLines)
      .where(and(eq(transcriptLines.callId, callId), eq(transcriptLines.speaker, "rep")));
    const confirm =
      repLines
        .map((l) => /confirmation(?: number| code)?(?: is)?[:\s]+([A-Z0-9][A-Z0-9-]{3,})/i.exec(l.textEn ?? ""))
        .find(Boolean)?.[1] ?? null;
    const oldMonthly = stored.caseFile.current_monthly;
    const debrief = liveDebrief(lang, oldMonthly, newMonthly, confirm);
    const en = lang === "en" ? debrief : liveDebrief("en", oldMonthly, newMonthly, confirm);
    await db.insert(outcomes).values({
      callId,
      result: "agreed",
      oldCents: dollarsToCents(oldMonthly),
      newCents: dollarsToCents(newMonthly),
      confirmationRef: confirm,
      debriefI18n: { [lang]: debrief, en },
      annualSavingsCents: dollarsToCents(debrief.annual_savings ?? 0),
    });
  }

  await db.update(calls).set({ status: "ended", endedAt: new Date() }).where(eq(calls.id, callId));
  await writeAudit({
    actor: "negotiator",
    event: "call.ended",
    callId,
    caseFileId: call.caseFileId,
    payload: { mode: "live", result: approved ? "agreed" : "no_deal", new_monthly: newMonthly || null },
  });
}
