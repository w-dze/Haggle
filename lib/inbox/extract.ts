import { PROVIDERS, providerByEmailDomain, type Provider } from "@/lib/providers";
import type { InboxMessage } from "./fixture";

// Deterministic field extraction from a billing email (no LLM). Output is the
// only thing Haggle keeps. Senders outside the verified provider list are
// recorded as untrusted with no amounts, and nothing inside any email (phone
// numbers, "instructions") is ever extracted or acted on.

export type ExtractedBillEvent = {
  provider: string | null;
  providerId: string | null;
  amountCents: number | null;
  previousAmountCents: number | null;
  dueDate: string | null;
  effectiveDate: string | null;
  changeType: "price_increase" | "receipt" | "statement" | "unverified_sender";
  sourceMessageId: string;
  trusted: boolean;
};

const NUM = String.raw`(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)`;
const MONEY = new RegExp(String.raw`\$\s?` + NUM, "g");
const DATE = /\b(\d{4}-\d{2}-\d{2})\b/g;

const toCents = (s: string) => Math.round(Number(s.replace(/,/g, "")) * 100);

function dateAfter(body: string, words: RegExp): string | null {
  const m = body.match(new RegExp(`${words.source}[^.]*?(\\d{4}-\\d{2}-\\d{2})`, "i"));
  return m ? m[m.length - 1] : null; // the date is the last group
}

export function extractBillEvent(msg: InboxMessage, providers: Provider[] = PROVIDERS): ExtractedBillEvent {
  const domain = msg.from.split("@")[1] ?? "";
  const provider = providerByEmailDomain(domain, providers);
  if (!provider) {
    return {
      provider: null,
      providerId: null,
      amountCents: null,
      previousAmountCents: null,
      dueDate: null,
      effectiveDate: null,
      changeType: "unverified_sender",
      sourceMessageId: msg.id,
      trusted: false,
    };
  }

  const text = `${msg.subject}. ${msg.body}`;
  const amounts = [...text.matchAll(MONEY)].map((m) => toCents(m[1]));
  const dates = [...text.matchAll(DATE)].map((m) => m[1]);
  const base = {
    provider: provider.name,
    providerId: provider.id,
    sourceMessageId: msg.id,
    trusted: true,
  };

  if (/\b(chang|increas|previously|new (rate|price|premium))/i.test(text) && amounts.length >= 2) {
    let prev: number;
    let next: number;
    const fromTo = text.match(new RegExp(String.raw`from \$\s?${NUM} to \$\s?${NUM}`, "i"));
    const previously = text.match(new RegExp(String.raw`\$\s?${NUM}\s*\(previously \$\s?${NUM}\)`, "i"));
    if (fromTo) [prev, next] = [toCents(fromTo[1]), toCents(fromTo[2])];
    else if (previously) [next, prev] = [toCents(previously[1]), toCents(previously[2])];
    else [prev, next] = [Math.min(...amounts), Math.max(...amounts)];
    return {
      ...base,
      amountCents: next,
      previousAmountCents: prev,
      dueDate: dateAfter(text, /\bdue\b/),
      effectiveDate: dateAfter(text, /\b(effective|starting)\b/) ?? dates[0] ?? null,
      changeType: "price_increase",
    };
  }

  if (/\b(receipt|charged)\b/i.test(text)) {
    return {
      ...base,
      amountCents: amounts[0] ?? null,
      previousAmountCents: null,
      dueDate: null,
      effectiveDate: dates[0] ?? null,
      changeType: "receipt",
    };
  }

  return {
    ...base,
    amountCents: amounts[0] ?? null,
    previousAmountCents: null,
    dueDate: dateAfter(text, /\bdue\b/),
    effectiveDate: dates[0] ?? null,
    changeType: "statement",
  };
}
