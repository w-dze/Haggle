import { eq } from "drizzle-orm";
import type { getDb } from "@/lib/db/client";
import { billEvents, transactions } from "@/lib/db/schema";
import { dollarsToCents } from "@/lib/money";
import { readDemoInbox } from "@/lib/inbox/fixture";
import { extractBillEvent } from "@/lib/inbox/extract";
import type { LoadedPersona } from "@/lib/data-source";

type Db = ReturnType<typeof getDb>;

const CHUNK = 200;

/**
 * Replace a persona's cached bank data and extracted inbox facts in Neon.
 * Only extracted email fields are written, never message bodies.
 */
export async function reloadPersonaData(db: Db, data: LoadedPersona) {
  const persona = data.persona.key;
  const rows = [
    ...data.purchases.map((p) => ({
      id: p._id,
      persona,
      kind: "purchase",
      merchantRaw: p.description,
      amountCents: dollarsToCents(p.amount),
      date: p.purchase_date,
      status: p.status,
      source: data.source,
    })),
    ...data.bills.map((b) => ({
      id: b._id,
      persona,
      kind: "bill",
      merchantRaw: b.payee,
      amountCents: dollarsToCents(b.payment_amount),
      date: b.payment_date,
      status: b.status,
      source: data.source,
    })),
  ];

  await db.delete(transactions).where(eq(transactions.persona, persona));
  for (let i = 0; i < rows.length; i += CHUNK) {
    await db.insert(transactions).values(rows.slice(i, i + CHUNK));
  }

  const events = readDemoInbox().map((msg) => ({ persona, ...extractBillEvent(msg) }));
  await db.delete(billEvents).where(eq(billEvents.persona, persona));
  if (events.length) await db.insert(billEvents).values(events);

  return { transactions: rows.length, billEvents: events.length };
}
