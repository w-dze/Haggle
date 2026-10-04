import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

import type { DemoPersona, NessieCreated } from "../lib/nessie/types";
import type { CheckupSeed } from "../lib/data-source";
import { generateMaria } from "../lib/persona/generate";

// Seeds the Nessie mock bank.
//
//   npm run seed                    Maria (bill check-up, 12 months) + load Neon
//   npm run seed -- --personas      also recreate the es/zh/ko intake demo personas
//   npm run seed -- --fixture-only  only (re)write data/fixtures/maria.json, no network
//   npm run seed -- --no-db         skip loading Neon
//
// data/fixtures/maria.json is always rewritten from the same deterministic
// generator, so the app has an identical fallback when Nessie is unavailable.
// Existing intake personas in data/nessie_demo.json are kept unless --personas.

const args = new Set(process.argv.slice(2));
const DEMO_FILE = join(process.cwd(), "data", "nessie_demo.json");
const FIXTURE_FILE = join(process.cwd(), "data", "fixtures", "maria.json");

const PERSONAS = [
  { lang: "es", first: "Maria", last: "Lopez" },
  { lang: "zh", first: "Wei", last: "Chen" },
  { lang: "ko", first: "Jiwoo", last: "Kim" },
] as const;

const ADDRESS = { street_number: "123", street_name: "Main St", city: "Ann Arbor", state: "MI", zip: "48104" };

function createdId(res: NessieCreated<{ _id?: string }>): string {
  const id = res.objectCreated?._id;
  if (!id) throw new Error(`Nessie create returned no id: ${JSON.stringify(res)}`);
  return id;
}

type DemoFile = { updated: string; demos: DemoPersona[]; checkup?: CheckupSeed };

function readDemoFile(): DemoFile {
  try {
    return JSON.parse(readFileSync(DEMO_FILE, "utf8")) as DemoFile;
  } catch {
    return { updated: "", demos: [] };
  }
}

/** Run async jobs with a small concurrency limit (Nessie is a shared free API). */
async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (i < items.length) await fn(items[i++]);
    }),
  );
}

// The original intake demo: three customers with a $89 internet bill each.
async function seedIntakePersonas(): Promise<DemoPersona[]> {
  const { nessieClient } = await import("../lib/nessie/client");
  const merchantId = createdId(
    (await nessieClient.createMerchant({
      name: "Comcastic Internet",
      address: { street_number: "1", street_name: "Network Way", city: "Ann Arbor", state: "MI", zip: "48104" },
      geocode: { lat: 42.28, lng: -83.74 },
    })) as NessieCreated<{ _id?: string }>,
  );

  const demos: DemoPersona[] = [];
  for (const p of PERSONAS) {
    const customerId = createdId(
      (await nessieClient.createCustomer({ first_name: p.first, last_name: p.last, address: ADDRESS })) as NessieCreated<{ _id?: string }>,
    );
    const accountId = createdId(
      (await nessieClient.createAccount(customerId, {
        type: "Checking",
        nickname: "Haggle checking",
        rewards: 0,
        balance: 320000,
      })) as NessieCreated<{ _id?: string }>,
    );
    const billId = createdId(
      (await nessieClient.createBill(accountId, {
        status: "pending",
        payee: "Comcastic Internet",
        nickname: "Home internet",
        payment_date: "2026-10-15",
        recurring_date: 15,
        payment_amount: 89,
      })) as NessieCreated<{ _id?: string }>,
    );
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
    demos.push({
      lang: p.lang,
      first: p.first,
      last: p.last,
      customer_id: customerId,
      account_id: accountId,
      bill_id: billId,
      payee: "Comcastic Internet",
      monthly: 89,
    });
    console.log(`  intake persona ${p.first} ${p.last} (${p.lang}) -> ${customerId}`);
  }
  return demos;
}

// Maria's 12-month check-up history, one Nessie merchant per fixture merchant.
async function seedCheckupPersona(data: ReturnType<typeof generateMaria>): Promise<CheckupSeed> {
  const { nessieClient } = await import("../lib/nessie/client");

  const merchants: Record<string, string> = {}; // nessie id -> fixture id
  const byFixture: Record<string, string> = {}; // fixture id -> nessie id
  for (const m of data.merchants) {
    const id = createdId(
      (await nessieClient.createMerchant({
        name: m.name,
        category: m.category,
        address: { street_number: "1", street_name: "Commerce St", city: "Ann Arbor", state: "MI", zip: "48104" },
        geocode: { lat: 42.28, lng: -83.74 },
      })) as NessieCreated<{ _id?: string }>,
    );
    merchants[id] = m._id;
    byFixture[m._id] = id;
  }

  const customerId = createdId(
    (await nessieClient.createCustomer({
      first_name: data.persona.first,
      last_name: data.persona.last,
      address: ADDRESS,
    })) as NessieCreated<{ _id?: string }>,
  );
  const accountId = createdId(
    (await nessieClient.createAccount(customerId, {
      type: "Checking",
      nickname: "Haggle check-up",
      rewards: 0,
      balance: 900000,
    })) as NessieCreated<{ _id?: string }>,
  );

  let done = 0;
  await pool(data.purchases, 5, async (p) => {
    await nessieClient.createPurchase(accountId, {
      merchant_id: byFixture[p.merchant_id],
      medium: p.medium,
      purchase_date: p.purchase_date,
      amount: p.amount,
      status: p.status,
      description: p.description,
    });
    done += 1;
    if (done % 25 === 0) console.log(`  purchases ${done}/${data.purchases.length}`);
  });
  await pool(data.bills, 5, async (b) => {
    await nessieClient.createBill(accountId, {
      status: b.status,
      payee: b.payee,
      nickname: b.nickname,
      payment_date: b.payment_date,
      recurring_date: Number(b.payment_date.slice(8, 10)),
      payment_amount: b.payment_amount,
    });
  });
  console.log(`  check-up persona ${data.persona.first} -> customer ${customerId}, account ${accountId}`);
  return { customer_id: customerId, account_id: accountId, merchants, seeded: new Date().toISOString() };
}

async function main() {
  const data = generateMaria();
  mkdirSync(join(process.cwd(), "data", "fixtures"), { recursive: true });
  writeFileSync(FIXTURE_FILE, JSON.stringify(data, null, 2) + "\n");
  console.log(
    `Wrote fixture ${FIXTURE_FILE} (${data.purchases.length} purchases, ${data.bills.length} bills)`,
  );
  if (args.has("--fixture-only")) return;

  const file = readDemoFile();
  let nessieOk = true;

  if (!process.env.NESSIE_API_KEY) {
    nessieOk = false;
    console.warn("NESSIE_API_KEY is not set. Skipping Nessie; the app will use the fixture.");
  } else {
    try {
      if (args.has("--personas") || file.demos.length === 0) {
        console.log("Seeding intake demo personas in Nessie...");
        file.demos = await seedIntakePersonas();
      } else {
        console.log(`Keeping ${file.demos.length} existing intake personas (pass --personas to recreate).`);
      }
      console.log(`Seeding check-up persona in Nessie (${data.purchases.length} purchases)...`);
      file.checkup = await seedCheckupPersona(data);
      file.updated = new Date().toISOString().slice(0, 10);
      writeFileSync(DEMO_FILE, JSON.stringify(file, null, 2) + "\n");
      console.log(`Wrote ${DEMO_FILE}`);
    } catch (err) {
      nessieOk = false;
      console.warn(`Nessie unavailable: ${err instanceof Error ? err.message : String(err)}`);
      console.warn("The app will fall back to data/fixtures/maria.json.");
    }
  }

  if (args.has("--no-db") || !process.env.DATABASE_URL) {
    console.log(process.env.DATABASE_URL ? "Skipping Neon (--no-db)." : "DATABASE_URL not set; skipping Neon.");
  } else {
    const { getDb } = await import("../lib/db/client");
    const { loadPersonaData } = await import("../lib/data-source");
    const { reloadPersonaData } = await import("../lib/checkup/store");
    const loaded = await loadPersonaData({ fresh: true, timeoutMs: 15000 });
    const counts = await reloadPersonaData(getDb(), loaded);
    console.log(`Loaded Neon from ${loaded.source}: ${counts.transactions} transactions, ${counts.billEvents} bill events.`);
  }

  console.log(`\nActive data source: ${nessieOk && existsSync(DEMO_FILE) ? "nessie" : "fixture"}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
