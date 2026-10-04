import competitorPlans from "@/data/competitor_plans.json";
import type { BillEventFact, Finding } from "@/lib/detect/types";
import { providerByName } from "@/lib/providers";
import { profileFor } from "@/lib/profiles";
import { CaseFile } from "@/lib/schemas";
import { callKind, findingSummary } from "./summaries";

// Pre-fills a negotiation case from a check-up finding. Deterministic (no
// LLM). The phone number comes only from data/providers.json, never from an
// email. Prices: current = the charge that looks off, target = the previous
// typical price, walk-away = halfway (rounded up to a whole dollar).

export const DEMO_LAST4 = "4821";

type Offer = { provider: string; plan: string; monthly: number };
const OFFERS: Record<string, Offer[]> = {
  home_internet: (competitorPlans as { home_internet?: Offer[] }).home_internet ?? [],
  mobile: (competitorPlans as { mobile?: Offer[] }).mobile ?? [],
};

const dollars = (cents: number) => Math.round(cents) / 100;

export type CheckupCase = {
  caseFile: CaseFile;
  currentCents: number;
  targetCents: number;
  walkawayCents: number;
  kind: "price" | "refund" | "cancel";
  phone: string | null;
  summaries: Record<"en" | "es" | "zh" | "ko", string>;
  intent: {
    goal: "lower_price" | "remove_fee" | "cancel";
    user_words: string;
    constraints: string[];
    checkup: { finding_id: string; type: Finding["type"]; kind: string; phone: string | null; provider_id: string | null };
  };
};

export function buildCaseFromFinding(f: Finding, billEvents: BillEventFact[], lang: string): CheckupCase {
  const kind = callKind(f.type);
  const provider = providerByName(f.display);
  const current = f.afterCents;
  const target = kind === "price" ? (f.beforeCents ?? current) : kind === "refund" ? current : 0;
  const walkaway = kind === "price" ? Math.ceil((current + target) / 200) * 100 : current;

  const summaries = {
    en: findingSummary(f, "en"),
    es: findingSummary(f, "es"),
    zh: findingSummary(f, "zh"),
    ko: findingSummary(f, "ko"),
  };
  const notice = billEvents.find((e) => e.trusted && f.evidence.emailIds.includes(e.sourceMessageId));

  const leverage: string[] = [];
  if (f.beforeCents !== null && kind === "price") leverage.push(`Paid $${dollars(f.beforeCents).toFixed(2)} until ${f.changeDate}.`);
  if (notice) leverage.push("The provider's own billing notice confirms the change.");
  if (f.type === "duplicate") leverage.push(`Two identical charges of $${dollars(current).toFixed(2)} within a few days.`);
  if (f.type === "new_recurring") leverage.push("No sign-up or billing email was found for this charge.");

  const offers = (OFFERS[f.category] ?? [])
    .filter((o) => Math.round(o.monthly * 100) < current)
    .slice(0, 3)
    .map((o) => ({ provider: o.provider, plan: o.plan, monthly: o.monthly, source: "curated_json" as const }));

  const concessions: Record<typeof kind, string[]> = {
    price: ["Return to the previous price", "Loyalty or promotional discount", "Remove the added fee"],
    refund: ["Refund the duplicate charge"],
    cancel: ["Cancel the subscription", "Refund the most recent charge"],
  };

  const caseFile = CaseFile.parse({
    account_holder_name: profileFor(lang).name,
    provider: f.display,
    service: provider?.service ?? f.category.replace(/_/g, " "),
    account_last4: DEMO_LAST4,
    current_monthly: dollars(current),
    target_monthly: dollars(target),
    walkaway_monthly: dollars(walkaway),
    issues: [summaries.en],
    leverage,
    competitor_offers: offers,
    allowed_concessions: concessions[kind],
    forbidden: [
      "Do not agree to a new contract or term",
      "Do not add services or upgrades",
      "Never share full account numbers, passwords or ID numbers",
    ],
  });

  return {
    caseFile,
    currentCents: current,
    targetCents: target,
    walkawayCents: walkaway,
    kind,
    phone: provider?.phone ?? null,
    summaries,
    intent: {
      goal: kind === "price" ? "lower_price" : kind === "refund" ? "remove_fee" : "cancel",
      user_words: summaries[(lang as keyof typeof summaries) in summaries ? (lang as keyof typeof summaries) : "en"],
      constraints: [],
      checkup: { finding_id: f.id, type: f.type, kind, phone: provider?.phone ?? null, provider_id: provider?.id ?? null },
    },
  };
}
