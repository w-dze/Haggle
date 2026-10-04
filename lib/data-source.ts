import { readFileSync } from "node:fs";
import { join } from "node:path";
import { env } from "@/lib/env";
import { nessieClient } from "@/lib/nessie/client";
import type { NessieBill, NessiePurchase } from "@/lib/nessie/types";
import type { PersonaBill, PersonaData, PersonaPurchase } from "@/lib/persona/generate";
import fixture from "@/data/fixtures/maria.json";

// Where the bill check-up gets bank data. Nessie (the mock bank) when it's
// seeded and reachable, otherwise the committed fixture with the same shape.
// The active source is always returned and logged so the UI can say which.

export type DataSource = "nessie" | "fixture";
export type LoadedPersona = PersonaData & { source: DataSource; reason: string };

export type CheckupSeed = {
  customer_id: string;
  account_id: string;
  merchants: Record<string, string>; // Nessie merchant _id -> fixture merchant _id
  seeded: string;
};

const FIXTURE = fixture as PersonaData;

function readCheckupSeed(): CheckupSeed | null {
  try {
    const raw = JSON.parse(readFileSync(join(process.cwd(), "data", "nessie_demo.json"), "utf8")) as {
      checkup?: CheckupSeed;
    };
    return raw.checkup ?? null;
  } catch {
    return null;
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms)),
  ]);
}

async function fromNessie(
  seed: CheckupSeed,
  timeoutMs: number,
): Promise<{ data: PersonaData; restored: number }> {
  const [purchases, bills] = await withTimeout(
    Promise.all([
      nessieClient.getPurchases(seed.account_id) as Promise<NessiePurchase[]>,
      nessieClient.getBills(seed.account_id) as Promise<NessieBill[]>,
    ]),
    timeoutMs,
  );
  if (!purchases.length) throw new Error("Nessie account has no purchases");

  // Nessie truncates purchase amounts to whole dollars ($9.99 comes back as 9).
  // Restore the cents from the generator when date, merchant and whole-dollar
  // amount all match, and count how often that happened so it can be reported.
  const exact = new Map<string, number[]>();
  for (const p of FIXTURE.purchases) {
    const k = `${p.purchase_date}|${p.merchant_id}|${Math.trunc(p.amount)}`;
    exact.set(k, [...(exact.get(k) ?? []), p.amount]);
  }
  let restored = 0;

  const mapped: PersonaPurchase[] = purchases
    .filter((p) => p.amount !== undefined && p.purchase_date)
    .map((p) => {
      const merchantId = seed.merchants[(p as { merchant_id?: string }).merchant_id ?? ""] ?? "unknown";
      const date = p.purchase_date!.slice(0, 10);
      const match = exact.get(`${date}|${merchantId}|${Math.trunc(p.amount!)}`)?.shift();
      if (match !== undefined && match !== p.amount) restored += 1;
      return {
        _id: p._id,
        merchant_id: merchantId,
        description: p.description ?? "",
        amount: match ?? p.amount!,
        purchase_date: date,
        status: "completed" as const,
        medium: "balance" as const,
      };
    });
  mapped.sort((a, z) => a.purchase_date.localeCompare(z.purchase_date) || a._id.localeCompare(z._id));

  const mappedBills: PersonaBill[] = bills
    .filter((b) => b.payment_amount !== undefined && b.payment_date)
    .map((b) => ({
      _id: b._id,
      payee: b.payee ?? "",
      nickname: b.nickname ?? "",
      payment_amount: b.payment_amount!,
      payment_date: b.payment_date!.slice(0, 10),
      status: "completed",
    }));

  // Persona metadata, merchant categories and labels come from the generator
  // (via the fixture); only the transactions come from the bank.
  return { data: { ...FIXTURE, purchases: mapped, bills: mappedBills }, restored };
}

let cached: { at: number; data: LoadedPersona } | null = null;
const CACHE_MS = 60_000;

/** Load Maria's bank data. Never throws: falls back to the fixture. */
export async function loadPersonaData(opts: { timeoutMs?: number; fresh?: boolean } = {}): Promise<LoadedPersona> {
  if (!opts.fresh && cached && Date.now() - cached.at < CACHE_MS) return cached.data;

  const pick = (data: PersonaData, source: DataSource, reason: string): LoadedPersona => {
    console.info(`[data-source] using ${source}: ${reason}`);
    const loaded = { ...data, source, reason };
    cached = { at: Date.now(), data: loaded };
    return loaded;
  };

  if (env.DATA_SOURCE === "fixture") return pick(FIXTURE, "fixture", "DATA_SOURCE=fixture");

  const seed = readCheckupSeed();
  if (!seed) return pick(FIXTURE, "fixture", "Nessie not seeded (no checkup entry in data/nessie_demo.json)");
  if (!env.NESSIE_API_KEY) return pick(FIXTURE, "fixture", "NESSIE_API_KEY not set");

  try {
    const { data, restored } = await fromNessie(seed, opts.timeoutMs ?? 4000);
    const note = restored ? `; cents restored on ${restored} purchases (Nessie stores whole dollars)` : "";
    return pick(data, "nessie", `account ${seed.account_id}${note}`);
  } catch (err) {
    if (env.DATA_SOURCE === "nessie") throw err;
    return pick(FIXTURE, "fixture", `Nessie unavailable (${err instanceof Error ? err.message : String(err)})`);
  }
}

/** The committed fixture, for mock mode (no network, no DB). */
export function fixturePersona(): LoadedPersona {
  return { ...FIXTURE, source: "fixture", reason: "mock mode" };
}
