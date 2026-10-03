import type { AnalystOutput } from "@/lib/gemini/analyst";
import type { BillExtraction, CaseFile, Intent } from "@/lib/schemas";

type Competitor = {
  provider: string;
  plan: string;
  monthly: number;
};

const EXPLANATIONS: Record<string, (p: { current: number; target: number; provider: string; cheapest: string }) => string> = {
  es: ({ current, target, provider, cheapest }) =>
    `Ahora pagas $${current} al mes por ${provider}. Eso está por encima de planes comparables. Un buen resultado sería bajar a unos $${target}/mes, cerca de ${cheapest}, sin firmar un contrato largo.`,
  zh: ({ current, target, provider, cheapest }) =>
    `你现在每月向 ${provider} 支付 $${current}。这高于市场上的类似套餐。比较理想的结果是降到大约 $${target}/月，接近 ${cheapest}，并且尽量不签长期合约。`,
  ko: ({ current, target, provider, cheapest }) =>
    `지금은 ${provider}에 매달 $${current}를 내고 있습니다. 비슷한 요금제보다 비쌉니다. 좋은 결과는 장기 약정 없이 ${cheapest}에 가깝게 월 $${target} 정도로 낮추는 것입니다.`,
  en: ({ current, target, provider, cheapest }) =>
    `You currently pay $${current}/mo for ${provider}, which is above comparable plans. A good result is getting close to $${target}/mo, in line with ${cheapest}, without a long contract.`,
};

function cheaperOffers(current: number, plans: Competitor[]): CaseFile["competitor_offers"] {
  return plans
    .filter((p) => p.monthly < current)
    .slice(0, 3)
    .map((p) => ({
      provider: p.provider,
      plan: p.plan,
      monthly: p.monthly,
      source: "curated_json" as const,
    }));
}

/** Deterministic case file — no Gemini. Used for Nessie demo and as a 503/429 fallback. */
export function buildLocalCaseFile(input: {
  extraction: BillExtraction;
  intent: Intent;
  holderName?: string;
  onTimeMonths?: number;
  competitorPlans: { home_internet?: Competitor[] };
  targetLang: string;
}): AnalystOutput {
  const current = input.extraction.total_monthly;
  const plans = input.competitorPlans.home_internet ?? [];
  const offers = cheaperOffers(current, plans);
  const cheapest = offers[0];
  const target = cheapest ? Math.round(cheapest.monthly) : Math.max(Math.round(current * 0.7), 1);
  const walkaway = Math.min(current, Math.max(target, Math.round((target + current) / 2)));
  const last4 = (input.extraction.account_last4 || "0000").slice(-4).padStart(4, "0");
  const cheapestLabel = cheapest ? `${cheapest.provider} ${cheapest.plan}` : "a cheaper plan";

  const leverage = [
    ...(input.onTimeMonths
      ? [`${input.onTimeMonths} months of on-time payments on this account`]
      : []),
    ...offers.map((o) => `${o.provider} ${o.plan} at $${o.monthly}/mo`),
  ];

  const case_file: CaseFile = {
    account_holder_name: input.holderName || "Account holder",
    provider: input.extraction.provider,
    service: input.extraction.plan_name || "home internet",
    account_last4: last4,
    current_monthly: current,
    target_monthly: target,
    walkaway_monthly: walkaway,
    issues: [
      `$${current}/mo is above comparable ${input.extraction.plan_name ?? "internet"} plans`,
      ...(input.intent.goal === "remove_fee" ? ["Bill includes a fee the user wants removed"] : []),
    ],
    leverage,
    competitor_offers: offers,
    allowed_concessions: ["Speed downgrade if price drops", "Promo for 12 months"],
    forbidden: input.intent.constraints.length ? input.intent.constraints : ["No new long-term contract"],
  };

  const explain = EXPLANATIONS[input.targetLang] ?? EXPLANATIONS.en;
  return {
    case_file,
    explanation: explain({
      current,
      target,
      provider: case_file.provider,
      cheapest: cheapestLabel,
    }),
  };
}
