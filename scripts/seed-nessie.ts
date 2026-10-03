import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

import type { DemoPersona, NessieCreated } from "../lib/nessie/types";

const PERSONAS = [
  { lang: "es", first: "Maria", last: "Lopez" },
  { lang: "zh", first: "Wei", last: "Chen" },
  { lang: "ko", first: "Jiwoo", last: "Kim" },
] as const;

function createdId(res: NessieCreated<{ _id?: string }>): string {
  const id = res.objectCreated?._id;
  if (!id) throw new Error(`Nessie create returned no id: ${JSON.stringify(res)}`);
  return id;
}

async function main() {
  const { nessieClient } = await import("../lib/nessie/client");
  console.log("Seeding Nessie demo data...");
  const merchant = (await nessieClient.createMerchant({
    name: "Comcastic Internet",
    address: {
      street_number: "1",
      street_name: "Network Way",
      city: "Ann Arbor",
      state: "MI",
      zip: "48104",
    },
    geocode: { lat: 42.28, lng: -83.74 },
  })) as NessieCreated<{ _id?: string }>;
  const merchantId = createdId(merchant);

  const demos: DemoPersona[] = [];
  for (const p of PERSONAS) {
    const customer = (await nessieClient.createCustomer({
      first_name: p.first,
      last_name: p.last,
      address: {
        street_number: "123",
        street_name: "Main St",
        city: "Ann Arbor",
        state: "MI",
        zip: "48104",
      },
    })) as NessieCreated<{ _id?: string }>;
    const customerId = createdId(customer);

    const account = (await nessieClient.createAccount(customerId, {
      type: "Checking",
      nickname: "Haggle checking",
      rewards: 0,
      balance: 320000,
    })) as NessieCreated<{ _id?: string }>;
    const accountId = createdId(account);

    const bill = (await nessieClient.createBill(accountId, {
      status: "pending",
      payee: "Comcastic Internet",
      nickname: "Home internet",
      payment_date: "2026-10-15",
      recurring_date: 15,
      payment_amount: 89,
    })) as NessieCreated<{ _id?: string }>;
    const billId = createdId(bill);

    for (const date of ["2026-07-15", "2026-08-15", "2026-09-15"]) {
      await nessieClient.createPurchase(accountId, {
        merchant_id: merchantId,
        medium: "balance",
        purchase_date: date,
        amount: 89,
        status: "completed",
        description: "Comcastic Internet",
      });
    }

    const row: DemoPersona = {
      lang: p.lang,
      first: p.first,
      last: p.last,
      customer_id: customerId,
      account_id: accountId,
      bill_id: billId,
      payee: "Comcastic Internet",
      monthly: 89,
    };
    demos.push(row);
    console.log(`  ${p.first} ${p.last} (${p.lang}) -> ${customerId}`);
  }

  const out = join(process.cwd(), "data", "nessie_demo.json");
  writeFileSync(out, JSON.stringify({ updated: new Date().toISOString().slice(0, 10), demos }, null, 2) + "\n");
  console.log(`Wrote ${out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
