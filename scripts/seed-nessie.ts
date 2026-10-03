import "dotenv/config";
import { nessieClient } from "../lib/nessie/client";

// Seeds 3 demo customers (one per language persona), each with a checking
// account, a recurring bill to a fictional "Comcastic Internet", and purchases
// that show months of on-time payments to use as leverage (§5.10).
// [Verify V8] which creates Nessie supports.

const PERSONAS = [
  { lang: "es", first: "Maria", last: "Lopez" },
  { lang: "zh", first: "Wei", last: "Chen" },
  { lang: "ko", first: "Jiwoo", last: "Kim" },
];

async function main() {
  console.log("Seeding Nessie demo data...");
  for (const p of PERSONAS) {
    try {
      // TODO: confirm Nessie create payloads (address fields, etc.).
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
      })) as { objectCreated?: { _id?: string } };

      const customerId = customer?.objectCreated?._id;
      console.log(`  ${p.first} ${p.last} (${p.lang}) -> ${customerId ?? "??"}`);
      // TODO: createAccount, createBill ("Comcastic Internet", $89/mo), purchases.
    } catch (err) {
      console.error(`  Failed for ${p.first}:`, err);
    }
  }
  console.log("Done. Record the customer IDs in your demo config.");
}

main();
