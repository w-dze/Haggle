import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { calls, transcriptLines, outcomes, caseFiles, approvals } from "@/lib/db/schema";
import { writeAudit } from "@/lib/audit";
import { loadStoredCase } from "@/lib/case-files";
import { dollarsToCents } from "@/lib/money";
import type { Debrief } from "@/lib/schemas";

type Turn = { speaker: "agent" | "rep"; en: string; tr: Record<string, string> };

function script(vars: {
  name: string;
  provider: string;
  service: string;
  last4: string;
  current: number;
  target: number;
  competitor: string;
  agreed: number;
  confirm: string;
}): Turn[] {
  const { name, provider, service, last4, current, target, competitor, agreed, confirm } = vars;
  return [
    {
      speaker: "agent",
      en: `Hi, this is an AI assistant calling on behalf of ${name} about the ${service} account ending in ${last4}.`,
      tr: {
        es: `Hola, soy un asistente de IA que llama en nombre de ${name} sobre la cuenta de ${service} que termina en ${last4}.`,
        zh: `您好，我是人工智能助手，代表 ${name} 来电，查询尾号 ${last4} 的${service}账户。`,
        ko: `안녕하세요, ${name}님을 대신해 끝자리 ${last4} ${service} 계정으로 전화한 AI 어시스턴트입니다.`,
        en: `Hi, this is an AI assistant calling on behalf of ${name} about the ${service} account ending in ${last4}.`,
      },
    },
    {
      speaker: "rep",
      en: `Thanks, I have ${name} on ${provider}. What's going on today?`,
      tr: {
        es: `Gracias, tengo a ${name} en ${provider}. ¿En qué puedo ayudar?`,
        zh: `好的，我看到 ${name} 在 ${provider} 的账户。今天有什么事？`,
        ko: `네, ${provider}에서 ${name}님 계정을 찾았습니다. 무슨 일이신가요?`,
        en: `Thanks, I have ${name} on ${provider}. What's going on today?`,
      },
    },
    {
      speaker: "agent",
      en: `They're paying $${current} a month. ${competitor} is cheaper, and we're hoping to get closer to $${target} without a new contract.`,
      tr: {
        es: `Pagan $${current} al mes. ${competitor} es más barato, y queremos acercarnos a $${target} sin un contrato nuevo.`,
        zh: `他们现在每月支付 $${current}。${competitor} 更便宜，我们希望在不签新合约的情况下降到大约 $${target}。`,
        ko: `지금은 월 $${current}입니다. ${competitor}가 더 저렴해서, 새 약정 없이 $${target} 정도로 낮추고 싶습니다.`,
        en: `They're paying $${current} a month. ${competitor} is cheaper, and we're hoping to get closer to $${target} without a new contract.`,
      },
    },
    {
      speaker: "rep",
      en: `I can do $${agreed} if they sign a 12-month term.`,
      tr: {
        es: `Puedo dejarlo en $${agreed} si firman 12 meses.`,
        zh: `如果签 12 个月合约，我可以降到 $${agreed}。`,
        ko: `12개월 약정을 하시면 $${agreed}로 해 드릴 수 있습니다.`,
        en: `I can do $${agreed} if they sign a 12-month term.`,
      },
    },
    {
      speaker: "agent",
      en: `They asked me not to accept a new contract. Can we do $${agreed} month-to-month?`,
      tr: {
        es: `Me pidieron no aceptar un contrato nuevo. ¿Se puede $${agreed} mes a mes?`,
        zh: `他们让我不要签新合约。能否按月 $${agreed}？`,
        ko: `새 약정은 안 된다고 하셨습니다. 월 단위로 $${agreed} 가능할까요?`,
        en: `They asked me not to accept a new contract. Can we do $${agreed} month-to-month?`,
      },
    },
    {
      speaker: "rep",
      en: `Okay — $${agreed} a month, no term. Confirmation ${confirm}.`,
      tr: {
        es: `De acuerdo: $${agreed} al mes, sin permanencia. Confirmación ${confirm}.`,
        zh: `可以，每月 $${agreed}，无合约。确认号 ${confirm}。`,
        ko: `알겠습니다. 약정 없이 월 $${agreed}. 확인 번호는 ${confirm}입니다.`,
        en: `Okay — $${agreed} a month, no term. Confirmation ${confirm}.`,
      },
    },
    {
      speaker: "agent",
      en: `That works. Thank you, we'll note ${confirm}. Have a good day.`,
      tr: {
        es: `Perfecto. Gracias, anotamos ${confirm}. Que tenga buen día.`,
        zh: `好的，我们记下 ${confirm}。谢谢，再见。`,
        ko: `좋습니다. ${confirm} 기록하겠습니다. 감사합니다.`,
        en: `That works. Thank you, we'll note ${confirm}. Have a good day.`,
      },
    },
  ];
}

function localDebrief(lang: string, oldM: number, newM: number, confirm: string): Debrief {
  const monthly = oldM - newM;
  const annual = monthly * 12;
  const prose: Record<string, string> = {
    es: `La llamada terminó en un acuerdo: de $${oldM} a $${newM} al mes (ahorras $${monthly}/mes, $${annual} al año). Confirmación ${confirm}. Sin contrato nuevo.`,
    zh: `通话已谈成：月费从 $${oldM} 降到 $${newM}（每月省 $${monthly}，每年约 $${annual}）。确认号 ${confirm}。没有新合约。`,
    ko: `합의했습니다. 월 $${oldM}에서 $${newM}로 낮아졌고 매달 $${monthly}, 연 $${annual}를 절약합니다. 확인 번호 ${confirm}. 새 약정은 없습니다.`,
    en: `The call ended in a deal: $${oldM} down to $${newM} a month (save $${monthly}/mo, $${annual}/yr). Confirmation ${confirm}. No new contract.`,
  };
  const next: Record<string, string[]> = {
    es: ["Guarda el número de confirmación.", "Revisa la próxima factura."],
    zh: ["保存确认号。", "核对下一期账单。"],
    ko: ["확인 번호를 보관하세요.", "다음 청구서를 확인하세요."],
    en: ["Save the confirmation number.", "Check the next bill."],
  };
  return {
    result: "agreed",
    old_monthly: oldM,
    new_monthly: newM,
    monthly_savings: monthly,
    annual_savings: annual,
    agreed_terms: [`$${newM}/mo month-to-month`, `confirmation ${confirm}`],
    next_steps: next[lang] ?? next.en,
    confirmation_ref: confirm,
    prose: prose[lang] ?? prose.en,
  };
}

async function stillActive(callId: string): Promise<boolean> {
  const db = getDb();
  const [row] = await db.select({ status: calls.status }).from(calls).where(eq(calls.id, callId)).limit(1);
  return !!row && !["ended", "failed", "killed"].includes(row.status ?? "");
}

export async function playSimulatedCall(callId: string, lang: string): Promise<void> {
  const db = getDb();
  const [call] = await db.select().from(calls).where(eq(calls.id, callId)).limit(1);
  if (!call?.caseFileId) return;
  const claimed = await db
    .update(calls)
    .set({ transcriptSource: "playing", status: "live" })
    .where(and(eq(calls.id, callId), eq(calls.transcriptSource, "queued")))
    .returning({ id: calls.id });
  if (!claimed[0]) return;

  const stored = await loadStoredCase(call.caseFileId);
  if (!stored) return;
  await writeAudit({ actor: "negotiator", event: "call.live", callId });

  const cf = stored.caseFile;
  const current = Math.round(cf.current_monthly);
  const target = Math.round(cf.target_monthly);
  const walkaway = Math.round(cf.walkaway_monthly);
  const agreed = Math.min(walkaway, Math.max(target, Math.round((current + target) / 2) - 5));
  const competitor = cf.competitor_offers[0]
    ? `${cf.competitor_offers[0].provider} $${cf.competitor_offers[0].monthly}`
    : "a cheaper plan";
  const confirm = `HG-${cf.account_last4}`;
  const turns = script({
    name: cf.account_holder_name || "the account holder",
    provider: cf.provider,
    service: cf.service,
    last4: cf.account_last4,
    current,
    target,
    competitor,
    agreed,
    confirm,
  });

  const offerTurns = turns.slice(0, -1);
  const closing = turns[turns.length - 1];

  let seq = 0;
  for (const turn of offerTurns) {
    if (!(await stillActive(callId))) return;
    seq += 1;
    const tr = turn.tr[lang] ?? turn.tr.en;
    await db.insert(transcriptLines).values({
      callId,
      seq,
      speaker: turn.speaker,
      textEn: turn.en,
      textTranslated: tr,
      lang,
      numbersOk: true,
      source: "script",
    });
    // Short gap only — the client holds the next subtitle until this line's
    // Grok Voice clip finishes, so a long server delay would desync.
    await new Promise((r) => setTimeout(r, 400));
  }

  if (!(await stillActive(callId))) return;

  const approvalCopy: Record<string, string> = {
    en: `${cf.provider} offers $${agreed}/month. Approve?`,
    es: `${cf.provider} ofrece $${agreed} al mes. ¿Aprobar?`,
    zh: `${cf.provider} 提供每月 $${agreed}。批准吗？`,
    ko: `${cf.provider}가 월 $${agreed}를 제안합니다. 승인할까요?`,
  };
  const [approval] = await db
    .insert(approvals)
    .values({
      callId,
      summaryEn: approvalCopy.en,
      summaryTranslated: approvalCopy[lang] ?? approvalCopy.en,
      offer: { monthly: agreed },
      status: "pending",
    })
    .returning({ id: approvals.id });
  if (!approval) return;

  let decision = "timeout";
  for (let i = 0; i < 90; i++) {
    if (!(await stillActive(callId))) return;
    const [row] = await db
      .select({ status: approvals.status })
      .from(approvals)
      .where(eq(approvals.id, approval.id))
      .limit(1);
    if (row?.status && row.status !== "pending") {
      decision = row.status;
      break;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  if (decision === "timeout") {
    await db.update(approvals).set({ status: "timeout" }).where(eq(approvals.id, approval.id));
  }

  if (!(await stillActive(callId))) return;

  if (decision !== "yes") {
    seq += 1;
    const noEn = "The account holder can't accept that today. Thank you for your time.";
    const noTr: Record<string, string> = {
      en: noEn,
      es: "La titular no puede aceptar eso hoy. Gracias por su tiempo.",
      zh: "账户持有人今天无法接受这个价格。感谢您的时间。",
      ko: "계정 소유자께서 오늘은 수락하기 어렵다고 하십니다. 시간 내주셔서 감사합니다.",
    };
    await db.insert(transcriptLines).values({
      callId,
      seq,
      speaker: "agent",
      textEn: noEn,
      textTranslated: noTr[lang] ?? noEn,
      lang,
      numbersOk: true,
      source: "script",
    });
    await db
      .update(calls)
      .set({ status: "ended", endedAt: new Date(), transcriptSource: "script" })
      .where(eq(calls.id, callId));
    await writeAudit({ actor: "negotiator", event: "call.ended", callId, payload: { result: "no_deal" } });
    return;
  }

  seq += 1;
  await db.insert(transcriptLines).values({
    callId,
    seq,
    speaker: closing.speaker,
    textEn: closing.en,
    textTranslated: closing.tr[lang] ?? closing.tr.en,
    lang,
    numbersOk: true,
    source: "script",
  });
  await new Promise((r) => setTimeout(r, 400));

  if (!(await stillActive(callId))) return;

  const debrief = localDebrief(lang, current, agreed, confirm);
  await db.insert(outcomes).values({
    callId,
    result: "agreed",
    oldCents: dollarsToCents(current),
    newCents: dollarsToCents(agreed),
    termMonths: 0,
    confirmationRef: confirm,
    debriefI18n: { [lang]: debrief, en: debrief },
    annualSavingsCents: dollarsToCents(debrief.annual_savings ?? 0),
  });
  await db
    .update(calls)
    .set({ status: "ended", endedAt: new Date(), transcriptSource: "script" })
    .where(eq(calls.id, callId));
  await db.update(caseFiles).set({ status: "locked" }).where(eq(caseFiles.id, call.caseFileId));
  await writeAudit({
    actor: "negotiator",
    event: "call.ended",
    callId,
    caseFileId: call.caseFileId,
    payload: { result: "agreed", new_monthly: agreed, confirmation: confirm },
  });
}

export async function killSimulatedCall(callId: string): Promise<void> {
  const db = getDb();
  await db.update(calls).set({ status: "killed", endedAt: new Date() }).where(eq(calls.id, callId));
  await writeAudit({ actor: "user", event: "call.killed", callId });
}
