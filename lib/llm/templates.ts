import type { FindingFacts } from "./facts";

// Deterministic explanations, used when the LLM is unavailable, rate-limited,
// or produces text whose numbers don't match the finding. Every number comes
// from the fact sheet. Causes are phrased as possibilities, never as facts,
// and nothing here is medical, legal or financial advice.
// Translations are marked for native-speaker review (messages/review-status.json).

export type Lang = "en" | "es" | "zh" | "ko";

export type ExplanationSections = {
  /** What changed, with the numbers. */
  what: string[];
  /** Possible causes, phrased as possibilities. */
  causes: string[];
  /** What the user can do. */
  actions: string[];
  /** Questions the user could ask the provider (used for insurance). */
  questions: string[];
};

const MONTHS: Record<Lang, string[]> = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  es: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
  zh: [],
  ko: [],
};

export function formatDate(date: string, lang: Lang): string {
  const [y, m, d] = date.split("-").map(Number);
  if (lang === "zh") return `${y}年${m}月${d}日`;
  if (lang === "ko") return `${y}년 ${m}월 ${d}일`;
  if (lang === "es") return `${d} de ${MONTHS.es[m - 1]} de ${y}`;
  return `${MONTHS.en[m - 1]} ${d}, ${y}`;
}

type T = { f: FindingFacts; date: (d: string) => string };

// One function per type and language. Keep sentences short and plain.
const TEXT: Record<Lang, Record<FindingFacts["type"], (t: T) => Omit<ExplanationSections, "questions">>> = {
  en: {
    price_jump: ({ f, date }) => ({
      what: [
        `Your ${f.provider} charge went from ${f.before} to ${f.after} on ${date(f.change_date)}. That is ${f.difference} more each time (${f.percent_change}% higher).`,
        `Since then you have paid ${f.extra_paid} more in total, over ${f.charges_since_change} charges.`,
      ],
      causes: [
        "A promotional or introductory price may have ended.",
        "The provider may have raised its prices.",
        "Your plan or services may have changed.",
      ],
      actions: [
        "Check your latest bill or online account for the reason.",
        `Ask ${f.provider} whether a lower price or a promotion is available.`,
        "If you did not agree to a change, you can ask them to explain it.",
      ],
    }),
    promo_expiry: ({ f, date }) => ({
      what: [
        `Your ${f.provider} price stayed at ${f.before} for about a year, then went up to ${f.after} on ${date(f.change_date)} (${f.percent_change}% higher).`,
        `Since then you have paid ${f.extra_paid} more in total.`,
      ],
      causes: [
        "A promotional price for new customers may have ended.",
        "The provider may have a yearly price change.",
      ],
      actions: [
        "Check your bill for a line about a promotion ending.",
        `Ask ${f.provider} whether a new promotion or loyalty discount is available.`,
      ],
    }),
    duplicate: ({ f, date }) => ({
      what: [
        `${f.provider} charged you ${f.after} twice: on ${date(f.charge_dates[0] ?? f.change_date)} and on ${date(f.change_date)}.`,
      ],
      causes: [
        "The payment may have gone through twice by mistake.",
        "One of the charges may be for a different account or service.",
      ],
      actions: [
        "Check that both charges appear on your bank statement.",
        `If one is a mistake, you can ask ${f.provider} to refund ${f.after}.`,
      ],
    }),
    creeping: ({ f }) => ({
      what: [
        `Your ${f.provider} charge has gone up ${f.charges_since_change} times in a row, from ${f.before} to ${f.after}.`,
        `Altogether you have paid ${f.extra_paid} more.`,
      ],
      causes: ["A fee on the bill may be increasing a little each month.", "Taxes or surcharges may have changed."],
      actions: [
        "Look at the line items on your latest bill.",
        `Ask ${f.provider} what changed and whether the fee can be removed.`,
      ],
    }),
    new_recurring: ({ f, date }) => ({
      what: [
        `A new charge from ${f.provider} for ${f.after} started on ${date(f.change_date)}. You have paid ${f.extra_paid} so far, over ${f.charges_since_change} charges.`,
        "We did not find a billing email about it.",
      ],
      causes: [
        "A free trial may have turned into a paid subscription.",
        "You or someone in your household may have signed up.",
      ],
      actions: [`Check whether you still use ${f.provider}.`, "If you don't, you can cancel it."],
    }),
    outlier: ({ f, date }) => ({
      what: [`Your ${f.provider} charge on ${date(f.latest_date)} was ${f.after}, much higher than your usual ${f.before}.`],
      causes: ["There may have been extra usage or a one-time fee.", "There may have been a billing mistake."],
      actions: [`Check the bill for that date.`, `If you don't recognise the charge, ask ${f.provider} about it.`],
    }),
    bill_mismatch: ({ f, date }) => ({
      what: [`Your ${f.provider} bill said ${f.before}, but ${f.after} was paid on ${date(f.change_date)}.`],
      causes: ["A late fee or an extra charge may have been added.", "There may have been a billing error."],
      actions: [`Compare the bill with your bank statement.`, `Ask ${f.provider} to explain the difference.`],
    }),
  },
  es: {
    price_jump: ({ f, date }) => ({
      what: [
        `Tu cargo de ${f.provider} pasó de ${f.before} a ${f.after} el ${date(f.change_date)}. Son ${f.difference} más cada vez (${f.percent_change}% más).`,
        `Desde entonces has pagado ${f.extra_paid} más en total, en ${f.charges_since_change} cargos.`,
      ],
      causes: [
        "Puede que haya terminado un precio promocional o de bienvenida.",
        "Puede que el proveedor haya subido sus precios.",
        "Puede que tu plan o tus servicios hayan cambiado.",
      ],
      actions: [
        "Revisa tu última factura o tu cuenta en línea para ver el motivo.",
        `Pregunta a ${f.provider} si hay un precio más bajo o una promoción.`,
        "Si no aceptaste ningún cambio, puedes pedirles que te lo expliquen.",
      ],
    }),
    promo_expiry: ({ f, date }) => ({
      what: [
        `Tu precio de ${f.provider} se mantuvo en ${f.before} durante casi un año y subió a ${f.after} el ${date(f.change_date)} (${f.percent_change}% más).`,
        `Desde entonces has pagado ${f.extra_paid} más en total.`,
      ],
      causes: [
        "Puede que haya terminado un precio promocional para clientes nuevos.",
        "Puede que el proveedor cambie sus precios cada año.",
      ],
      actions: [
        "Busca en tu factura una línea sobre el fin de una promoción.",
        `Pregunta a ${f.provider} si hay una nueva promoción o un descuento por fidelidad.`,
      ],
    }),
    duplicate: ({ f, date }) => ({
      what: [
        `${f.provider} te cobró ${f.after} dos veces: el ${date(f.charge_dates[0] ?? f.change_date)} y el ${date(f.change_date)}.`,
      ],
      causes: [
        "Puede que el pago se haya procesado dos veces por error.",
        "Puede que uno de los cargos sea de otra cuenta u otro servicio.",
      ],
      actions: [
        "Comprueba que los dos cargos aparecen en tu estado de cuenta.",
        `Si uno es un error, puedes pedir a ${f.provider} que te devuelva ${f.after}.`,
      ],
    }),
    creeping: ({ f }) => ({
      what: [
        `Tu cargo de ${f.provider} ha subido ${f.charges_since_change} veces seguidas, de ${f.before} a ${f.after}.`,
        `En total has pagado ${f.extra_paid} más.`,
      ],
      causes: ["Puede que una tarifa de la factura suba un poco cada mes.", "Puede que hayan cambiado impuestos o recargos."],
      actions: [
        "Revisa los conceptos de tu última factura.",
        `Pregunta a ${f.provider} qué cambió y si se puede quitar esa tarifa.`,
      ],
    }),
    new_recurring: ({ f, date }) => ({
      what: [
        `Un cargo nuevo de ${f.provider} por ${f.after} empezó el ${date(f.change_date)}. Hasta ahora has pagado ${f.extra_paid}, en ${f.charges_since_change} cargos.`,
        "No encontramos ningún correo de facturación sobre este cargo.",
      ],
      causes: [
        "Puede que una prueba gratuita se haya convertido en una suscripción de pago.",
        "Puede que tú o alguien de tu hogar se haya suscrito.",
      ],
      actions: [`Comprueba si todavía usas ${f.provider}.`, "Si no lo usas, puedes cancelarlo."],
    }),
    outlier: ({ f, date }) => ({
      what: [`Tu cargo de ${f.provider} del ${date(f.latest_date)} fue de ${f.after}, mucho más que lo habitual (${f.before}).`],
      causes: ["Puede que haya habido un uso adicional o una tarifa única.", "Puede que haya un error de facturación."],
      actions: ["Revisa la factura de esa fecha.", `Si no reconoces el cargo, pregunta a ${f.provider}.`],
    }),
    bill_mismatch: ({ f, date }) => ({
      what: [`Tu factura de ${f.provider} decía ${f.before}, pero el ${date(f.change_date)} se pagaron ${f.after}.`],
      causes: ["Puede que se haya añadido un recargo por retraso u otro cargo.", "Puede que haya un error de facturación."],
      actions: ["Compara la factura con tu estado de cuenta.", `Pide a ${f.provider} que te explique la diferencia.`],
    }),
  },
  zh: {
    price_jump: ({ f, date }) => ({
      what: [
        `您的 ${f.provider} 费用在${date(f.change_date)}从 ${f.before} 变为 ${f.after}，每次多付 ${f.difference}（上涨 ${f.percent_change}%）。`,
        `从那以后，您在 ${f.charges_since_change} 笔扣款中一共多付了 ${f.extra_paid}。`,
      ],
      causes: ["可能是优惠价或新客价到期了。", "可能是服务商涨价了。", "可能是您的套餐或服务有变化。"],
      actions: [
        "查看最新账单或网上账户，了解原因。",
        `问问 ${f.provider} 是否有更低的价格或优惠。`,
        "如果您没有同意过任何变更，可以请他们解释。",
      ],
    }),
    promo_expiry: ({ f, date }) => ({
      what: [
        `您的 ${f.provider} 价格在大约一年里一直是 ${f.before}，然后在${date(f.change_date)}涨到 ${f.after}（上涨 ${f.percent_change}%）。`,
        `从那以后您一共多付了 ${f.extra_paid}。`,
      ],
      causes: ["可能是新客户优惠价到期了。", "可能是服务商每年调整价格。"],
      actions: ["在账单上找找有没有优惠到期的说明。", `问问 ${f.provider} 是否有新的优惠或老客户折扣。`],
    }),
    duplicate: ({ f, date }) => ({
      what: [`${f.provider} 向您收取了两次 ${f.after}：分别在${date(f.charge_dates[0] ?? f.change_date)}和${date(f.change_date)}。`],
      causes: ["可能是付款被误扣了两次。", "其中一笔可能属于其他账户或服务。"],
      actions: ["确认这两笔扣款都出现在您的银行账单上。", `如果其中一笔是误扣，您可以请 ${f.provider} 退还 ${f.after}。`],
    }),
    creeping: ({ f }) => ({
      what: [
        `您的 ${f.provider} 费用已经连续上涨 ${f.charges_since_change} 次，从 ${f.before} 涨到 ${f.after}。`,
        `您一共多付了 ${f.extra_paid}。`,
      ],
      causes: ["账单上的某项费用可能每月都在小幅上涨。", "税费或附加费可能有变化。"],
      actions: ["查看最新账单上的各项明细。", `问问 ${f.provider} 有什么变化，这项费用能否取消。`],
    }),
    new_recurring: ({ f, date }) => ({
      what: [
        `${f.provider} 从${date(f.change_date)}开始每次收取 ${f.after}。到目前为止，您在 ${f.charges_since_change} 笔扣款中共支付了 ${f.extra_paid}。`,
        "我们没有找到相关的账单邮件。",
      ],
      causes: ["可能是免费试用转成了付费订阅。", "可能是您或家人注册了这项服务。"],
      actions: [`确认您是否还在使用 ${f.provider}。`, "如果不再使用，可以取消订阅。"],
    }),
    outlier: ({ f, date }) => ({
      what: [`您在${date(f.latest_date)}的 ${f.provider} 费用是 ${f.after}，比平时的 ${f.before} 高很多。`],
      causes: ["可能有额外用量或一次性费用。", "可能是账单出错。"],
      actions: ["查看那天的账单。", `如果您不认得这笔费用，可以问问 ${f.provider}。`],
    }),
    bill_mismatch: ({ f, date }) => ({
      what: [`您的 ${f.provider} 账单金额是 ${f.before}，但${date(f.change_date)}实际支付了 ${f.after}。`],
      causes: ["可能加收了滞纳金或其他费用。", "可能是账单出错。"],
      actions: ["把账单和银行流水对照一下。", `请 ${f.provider} 解释差额。`],
    }),
  },
  ko: {
    price_jump: ({ f, date }) => ({
      what: [
        `${f.provider} 요금이 ${date(f.change_date)}에 ${f.before}에서 ${f.after}(으)로 바뀌었습니다. 매번 ${f.difference} 더 내는 셈입니다(${f.percent_change}% 인상).`,
        `그 뒤로 ${f.charges_since_change}번의 결제에서 모두 ${f.extra_paid}를 더 냈습니다.`,
      ],
      causes: ["프로모션이나 신규 가입 요금이 끝났을 수 있습니다.", "회사가 요금을 올렸을 수 있습니다.", "요금제나 서비스가 바뀌었을 수 있습니다."],
      actions: [
        "최근 청구서나 온라인 계정에서 이유를 확인해 보세요.",
        `${f.provider}에 더 저렴한 요금이나 프로모션이 있는지 물어보세요.`,
        "변경에 동의한 적이 없다면 설명을 요청할 수 있습니다.",
      ],
    }),
    promo_expiry: ({ f, date }) => ({
      what: [
        `${f.provider} 요금이 약 1년 동안 ${f.before}였다가 ${date(f.change_date)}에 ${f.after}(으)로 올랐습니다(${f.percent_change}% 인상).`,
        `그 뒤로 모두 ${f.extra_paid}를 더 냈습니다.`,
      ],
      causes: ["신규 고객 프로모션 요금이 끝났을 수 있습니다.", "회사가 매년 요금을 조정할 수 있습니다."],
      actions: ["청구서에 프로모션 종료 안내가 있는지 확인해 보세요.", `${f.provider}에 새 프로모션이나 장기 고객 할인이 있는지 물어보세요.`],
    }),
    duplicate: ({ f, date }) => ({
      what: [`${f.provider}에서 ${f.after}를 두 번 청구했습니다: ${date(f.charge_dates[0] ?? f.change_date)}과 ${date(f.change_date)}.`],
      causes: ["결제가 실수로 두 번 처리되었을 수 있습니다.", "둘 중 하나는 다른 계정이나 서비스 요금일 수 있습니다."],
      actions: ["두 결제가 모두 은행 거래 내역에 있는지 확인해 보세요.", `하나가 실수라면 ${f.provider}에 ${f.after} 환불을 요청할 수 있습니다.`],
    }),
    creeping: ({ f }) => ({
      what: [
        `${f.provider} 요금이 ${f.charges_since_change}번 연속으로 올라 ${f.before}에서 ${f.after}이(가) 되었습니다.`,
        `모두 ${f.extra_paid}를 더 냈습니다.`,
      ],
      causes: ["청구서의 어떤 수수료가 매달 조금씩 오르고 있을 수 있습니다.", "세금이나 추가 요금이 바뀌었을 수 있습니다."],
      actions: ["최근 청구서의 항목을 살펴보세요.", `${f.provider}에 무엇이 바뀌었는지, 그 수수료를 없앨 수 있는지 물어보세요.`],
    }),
    new_recurring: ({ f, date }) => ({
      what: [
        `${f.provider}의 새 요금 ${f.after}이(가) ${date(f.change_date)}부터 청구되었습니다. 지금까지 ${f.charges_since_change}번 결제로 ${f.extra_paid}를 냈습니다.`,
        "이 요금에 대한 청구 이메일은 찾지 못했습니다.",
      ],
      causes: ["무료 체험이 유료 구독으로 바뀌었을 수 있습니다.", "본인이나 가족이 가입했을 수 있습니다."],
      actions: [`${f.provider}를 아직 사용하는지 확인해 보세요.`, "사용하지 않는다면 해지할 수 있습니다."],
    }),
    outlier: ({ f, date }) => ({
      what: [`${date(f.latest_date)}의 ${f.provider} 요금은 ${f.after}로, 평소 ${f.before}보다 훨씬 높았습니다.`],
      causes: ["추가 사용량이나 일회성 요금이 있었을 수 있습니다.", "청구 오류가 있었을 수 있습니다."],
      actions: ["그날의 청구서를 확인해 보세요.", `모르는 요금이라면 ${f.provider}에 문의해 보세요.`],
    }),
    bill_mismatch: ({ f, date }) => ({
      what: [`${f.provider} 청구서에는 ${f.before}로 되어 있었지만 ${date(f.change_date)}에 ${f.after}가 결제되었습니다.`],
      causes: ["연체료나 다른 요금이 추가되었을 수 있습니다.", "청구 오류가 있었을 수 있습니다."],
      actions: ["청구서와 은행 거래 내역을 비교해 보세요.", `${f.provider}에 차액을 설명해 달라고 요청하세요.`],
    }),
  },
};

const NOTICE: Record<Lang, (f: FindingFacts, date: (d: string) => string) => string> = {
  en: (f, date) => `${f.provider} sent a billing email about this change${f.email_notice?.effective_date ? `, effective ${date(f.email_notice.effective_date)}` : ""}.`,
  es: (f, date) => `${f.provider} envió un correo de facturación sobre este cambio${f.email_notice?.effective_date ? `, con vigencia desde el ${date(f.email_notice.effective_date)}` : ""}.`,
  zh: (f, date) => `${f.provider} 发过一封关于这次变化的账单邮件${f.email_notice?.effective_date ? `，自${date(f.email_notice.effective_date)}起生效` : ""}。`,
  ko: (f, date) => `${f.provider}에서 이 변경에 대한 청구 이메일을 보냈습니다${f.email_notice?.effective_date ? `(${date(f.email_notice.effective_date)}부터 적용)` : ""}.`,
};

const SEASONAL: Record<Lang, string> = {
  en: "The same rise happened around this time last year, so this may be a normal seasonal change.",
  es: "El año pasado hubo una subida parecida por estas fechas, así que puede ser un cambio normal de temporada.",
  zh: "去年同一时期也有类似的上涨，所以这可能是正常的季节性变化。",
  ko: "작년 이맘때에도 비슷하게 올랐으므로 정상적인 계절 변화일 수 있습니다.",
};

const OFFERS: Record<Lang, (o: FindingFacts["curated_offers"]) => string> = {
  en: (o) => `For comparison, our hand-curated sample list (not live prices) includes ${o.map((x) => `${x.provider} ${x.plan} at ${x.monthly}`).join(", ")} per month.`,
  es: (o) => `Como referencia, nuestra lista de muestra seleccionada a mano (no son precios en vivo) incluye ${o.map((x) => `${x.provider} ${x.plan} por ${x.monthly}`).join(", ")} al mes.`,
  zh: (o) => `作为参考，我们手工整理的样本列表（非实时价格）中有：${o.map((x) => `${x.provider} ${x.plan} 每月 ${x.monthly}`).join("，")}。`,
  ko: (o) => `참고로, 직접 정리한 샘플 목록(실시간 가격 아님)에는 ${o.map((x) => `${x.provider} ${x.plan} 월 ${x.monthly}`).join(", ")}가 있습니다.`,
};

// Insurance: only describe what the document says and suggest questions.
const INSURANCE: Record<Lang, { causes: string[]; actions: string[]; questions: string[] }> = {
  en: {
    causes: ["Premiums are often updated once a year.", "Your plan or coverage may have changed."],
    actions: ["Read the premium notice or your plan documents to see what they say about the new amount."],
    questions: ["Why did my premium change?", "Did my coverage change too?", "Is there a plan with similar coverage that costs less?"],
  },
  es: {
    causes: ["Las primas suelen actualizarse una vez al año.", "Puede que tu plan o tu cobertura hayan cambiado."],
    actions: ["Lee el aviso de prima o los documentos de tu plan para ver qué dicen sobre el nuevo importe."],
    questions: ["¿Por qué cambió mi prima?", "¿También cambió mi cobertura?", "¿Hay un plan con una cobertura parecida que cueste menos?"],
  },
  zh: {
    causes: ["保费通常每年调整一次。", "您的保险方案或保障范围可能有变化。"],
    actions: ["阅读保费通知或保单文件，看看上面对新金额是怎么说明的。"],
    questions: ["我的保费为什么变了？", "我的保障范围也变了吗？", "有没有保障相近但更便宜的方案？"],
  },
  ko: {
    causes: ["보험료는 보통 1년에 한 번 조정됩니다.", "보험 플랜이나 보장 내용이 바뀌었을 수 있습니다."],
    actions: ["보험료 안내문이나 보험 서류에서 새 금액에 대해 어떻게 설명하는지 읽어 보세요."],
    questions: ["보험료가 왜 바뀌었나요?", "보장 내용도 바뀌었나요?", "보장은 비슷하면서 더 저렴한 플랜이 있나요?"],
  },
};

export function templateExplanation(f: FindingFacts, lang: Lang): ExplanationSections {
  const date = (d: string) => formatDate(d, lang);
  const base = TEXT[lang][f.type]({ f, date });
  const what = [...base.what];
  if (f.email_notice) what.push(NOTICE[lang](f, date));
  if (f.seasonal) what.push(SEASONAL[lang]);
  let causes = base.causes;
  let actions = [...base.actions];
  let questions: string[] = [];
  if (f.category === "insurance") {
    causes = INSURANCE[lang].causes;
    actions = INSURANCE[lang].actions;
    questions = INSURANCE[lang].questions;
  } else if (f.curated_offers.length) {
    actions.push(OFFERS[lang](f.curated_offers));
  }
  return { what, causes, actions, questions };
}
