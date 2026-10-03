import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, failMsg } from "@/lib/response";
import { getDb } from "@/lib/db/client";
import { bills } from "@/lib/db/schema";
import { writeAudit } from "@/lib/audit";
import { dollarsToCents } from "@/lib/money";
import { last4 } from "@/lib/guardrails/mask";
import { nessieClient } from "@/lib/nessie/client";
import type { BillExtraction } from "@/lib/schemas";
import type { NessieAccount, NessieBill, NessieCustomer } from "@/lib/nessie/types";

export const runtime = "nodejs";

const Body = z.object({
  customer_id: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return failMsg("bad_request", parsed.error.message, 400);

  try {
    const customer = (await nessieClient.getCustomer(parsed.data.customer_id)) as NessieCustomer;
    const accounts = (await nessieClient.getAccounts(parsed.data.customer_id)) as NessieAccount[];
    const account = accounts[0];
    if (!account) return failMsg("not_found", "Nessie customer has no account", 404);

    const nessieBills = (await nessieClient.getBills(account._id)) as NessieBill[];
    const bill = nessieBills[0];
    if (!bill) return failMsg("not_found", "Nessie account has no bill", 404);

    const amount = Number(bill.payment_amount ?? 0);
    const digits = last4(account.account_number ?? "0000");
    const extraction: BillExtraction = {
      provider: bill.payee || "Comcastic Internet",
      plan_name: bill.nickname || "Home internet",
      line_items: [{ label: bill.payee || "Internet", amount }],
      total_monthly: amount,
      due_date: bill.upcoming_payment_date ?? bill.payment_date,
      account_last4: digits,
      original_language: "en",
    };

    const db = getDb();
    const [row] = await db
      .insert(bills)
      .values({
        source: "nessie",
        provider: extraction.provider,
        planName: extraction.plan_name ?? null,
        amountCents: dollarsToCents(amount),
        currency: "USD",
        lineItems: extraction.line_items,
        accountLast4: digits,
        rawOcr: extraction,
        imagePath: null,
      })
      .returning({ id: bills.id });

    await writeAudit({
      actor: "intake",
      event: "bill.from_nessie",
      payload: {
        bill_id: row.id,
        nessie_customer_id: parsed.data.customer_id,
        holder: `${customer.first_name} ${customer.last_name}`,
      },
    });

    return ok({
      bill_id: row.id,
      extraction,
      holder_name: `${customer.first_name} ${customer.last_name}`,
      nessie_customer_id: parsed.data.customer_id,
    });
  } catch (err) {
    return failMsg("nessie_bill_failed", String(err), 500);
  }
}
