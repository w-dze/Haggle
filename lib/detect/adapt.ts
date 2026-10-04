import type { PersonaData } from "@/lib/persona/generate";
import { dollarsToCents } from "@/lib/money";
import type { BillEventFact, DetectInput, Dismissal } from "./types";

/** Build detector input from persona data (Nessie or fixture) plus inbox facts. */
export function inputFromPersona(
  data: PersonaData,
  billEvents: BillEventFact[],
  dismissals: Dismissal[] = [],
): DetectInput {
  const categories = new Map(data.merchants.map((m) => [m._id, m.category]));
  return {
    asOf: data.asOf,
    charges: data.purchases.map((p) => ({
      id: p._id,
      merchantRaw: p.description,
      amountCents: dollarsToCents(p.amount),
      date: p.purchase_date,
      category: categories.get(p.merchant_id),
    })),
    bills: data.bills.map((b) => ({
      id: b._id,
      payee: b.payee,
      amountCents: dollarsToCents(b.payment_amount),
      date: b.payment_date,
    })),
    billEvents,
    dismissals,
  };
}
