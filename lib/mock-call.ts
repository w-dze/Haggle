import type { StreamEvent } from "@/lib/bus";

// Scripted call for the public demo (?mock=1). Emits the same StreamEvent
// shapes as /api/calls/:id/stream, so the call page can't tell the difference.
// Works in production builds on purpose: it needs no backend, keys or phone.
// Placeholder content (Northwind, $89 -> $70); zh/ko text needs native review.

type Text = { en: string; es: string; zh: string; ko: string };
type Speaker = "agent" | "rep";

const pick = (text: Text, lang: string) => text[lang as keyof Text] ?? text.en;

const SCRIPT: Array<{ speaker: Speaker; text: Text; numbers_ok?: boolean }> = [
  {
    speaker: "agent",
    text: {
      en: "Hi, I'm Haggle, an AI assistant calling on behalf of Maria Lopez.",
      es: "Hola, soy Haggle, un asistente de IA que llama en nombre de María López.",
      zh: "您好，我是 Haggle，一个代表 Maria Lopez 致电的 AI 助手。",
      ko: "안녕하세요, 저는 Maria Lopez 님을 대신해 전화드리는 AI 어시스턴트 Haggle입니다.",
    },
  },
  {
    speaker: "rep",
    text: {
      en: "Northwind billing, how can I help you?",
      es: "Facturación de Northwind, ¿en qué puedo ayudarle?",
      zh: "这里是 Northwind 账单部，有什么可以帮您？",
      ko: "Northwind 요금 담당입니다. 무엇을 도와드릴까요?",
    },
  },
  {
    speaker: "agent",
    text: {
      en: "She'd like a lower rate. She has been a customer for four years.",
      es: "Ella quisiera una tarifa más baja. Es clienta desde hace cuatro años.",
      zh: "她希望降低资费。她已经是四年的老客户了。",
      ko: "요금을 낮추고 싶어 하십니다. 4년째 이용 중인 고객이십니다.",
    },
  },
  {
    speaker: "rep",
    numbers_ok: false,
    text: {
      en: "I can offer seventy-nine dollars a month for twelve months.",
      es: "Puedo ofrecerle setenta y nueve dólares al mes durante doce meses.",
      zh: "我可以给您每月七十九美元，为期十二个月。",
      ko: "12개월 동안 월 79달러를 제안드릴 수 있습니다.",
    },
  },
  {
    speaker: "agent",
    text: {
      en: "A competitor offers sixty-five. Can you match it?",
      es: "Un competidor ofrece sesenta y cinco. ¿Pueden igualarlo?",
      zh: "竞争对手的报价是六十五美元。您能匹配吗？",
      ko: "경쟁사는 65달러를 제시합니다. 맞춰 주실 수 있나요?",
    },
  },
  {
    speaker: "rep",
    text: {
      en: "I can do seventy dollars for twelve months.",
      es: "Puedo dejarlo en setenta dólares durante doce meses.",
      zh: "我可以给到七十美元，为期十二个月。",
      ko: "12개월 동안 70달러까지 해드릴 수 있습니다.",
    },
  },
];

const APPROVAL: Text = {
  en: "Northwind offers $70/month for 12 months. Approve?",
  es: "Northwind ofrece $70 al mes por 12 meses. ¿Aprobar?",
  zh: "Northwind 提供每月 $70，为期 12 个月。批准吗？",
  ko: "Northwind가 12개월간 월 $70를 제안합니다. 승인할까요?",
};

const CLOSING: Record<"yes" | "no", Text> = {
  yes: {
    en: "Agreed, the account holder approved. Thank you for your help.",
    es: "De acuerdo, la titular aprobó. Muchas gracias por su ayuda.",
    zh: "好的，账户持有人已同意。非常感谢您的帮助。",
    ko: "좋습니다, 계정 소유자께서 승인하셨습니다. 도와주셔서 감사합니다.",
  },
  no: {
    en: "The account holder can't accept that today. Thank you for your time.",
    es: "La titular no puede aceptar eso hoy. Gracias por su tiempo.",
    zh: "账户持有人今天无法接受这个价格。感谢您的时间。",
    ko: "계정 소유자께서 오늘은 수락하기 어렵다고 하십니다. 시간 내주셔서 감사합니다.",
  },
};

export const MOCK_OUTCOME = { result: "accepted", old: 89, new: 70 } as const;

const APPROVAL_ID = "mock-approval";
const APPROVAL_WINDOW_MS = 45_000;
const CONNECT_MS = 2500;
const LINE_GAP_MS = 2600;

/** Keep the scripted demo in mock mode as the user moves between screens. */
export function mockHref(href: string, isMock: boolean): string {
  if (!isMock) return href;
  return `${href}${href.includes("?") ? "&" : "?"}mock=1`;
}

export type MockCallControls = {
  answer(decision: "yes" | "no"): void;
  end(): void;
  stop(): void;
};

export function runMockCall(lang: string, emit: (evt: StreamEvent) => void): MockCallControls {
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let seq = 0;
  let awaitingAnswer = false;
  let finished = false;

  const after = (ms: number, fn: () => void) => {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  };
  const stop = () => {
    timers.forEach(clearTimeout);
    timers.clear();
  };
  const line = (speaker: Speaker, text: Text, numbers_ok = true) =>
    emit({ type: "line", seq: ++seq, speaker, en: text.en, tr: pick(text, lang), numbers_ok });

  function resolve(decision: "yes" | "no", status: "yes" | "no" | "timeout") {
    if (!awaitingAnswer) return;
    awaitingAnswer = false;
    stop();
    emit({ type: "approval_resolved", id: APPROVAL_ID, status });
    after(1800, () => line("agent", CLOSING[decision]));
    after(3200, () => {
      if (decision === "yes") emit({ type: "outcome", ...MOCK_OUTCOME });
      emit({ type: "status", status: "ended" });
      finished = true;
    });
  }

  emit({ type: "status", status: "dialing" });
  after(CONNECT_MS, () => emit({ type: "status", status: "live" }));
  SCRIPT.forEach((l, i) =>
    after(CONNECT_MS + 600 + i * LINE_GAP_MS, () => line(l.speaker, l.text, l.numbers_ok)),
  );
  after(CONNECT_MS + 600 + SCRIPT.length * LINE_GAP_MS, () => {
    awaitingAnswer = true;
    emit({
      type: "approval",
      id: APPROVAL_ID,
      summary: pick(APPROVAL, lang),
      summary_en: APPROVAL.en,
      expires_at: new Date(Date.now() + APPROVAL_WINDOW_MS).toISOString(),
    });
    after(APPROVAL_WINDOW_MS, () => resolve("no", "timeout"));
  });

  return {
    answer: (decision) => resolve(decision, decision),
    end: () => {
      if (finished) return;
      finished = true;
      awaitingAnswer = false;
      stop();
      emit({ type: "status", status: "killed" });
    },
    stop,
  };
}
