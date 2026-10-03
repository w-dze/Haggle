import { env, requireEnv } from "@/lib/env";

// Capital One Nessie (mock banking) client (§5.10). Nessie authenticates with a
// `key` query param. [Verify V8] endpoint shapes and whether bills can be created.

async function nessie<T>(path: string, init?: RequestInit): Promise<T> {
  const key = requireEnv("NESSIE_API_KEY");
  const sep = path.includes("?") ? "&" : "?";
  const url = `${env.NESSIE_BASE_URL}${path}${sep}key=${key}`;
  const res = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    throw new Error(`Nessie ${res.status} on ${path}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

export const nessieClient = {
  getCustomer: (customerId: string) => nessie(`/customers/${customerId}`),
  getAccounts: (customerId: string) => nessie(`/customers/${customerId}/accounts`),
  getBills: (accountId: string) => nessie(`/accounts/${accountId}/bills`),
  getPurchases: (accountId: string) => nessie(`/accounts/${accountId}/purchases`),
  // Seed helpers (used by scripts/seed-nessie.ts) — [Verify] which creates are supported.
  createCustomer: (body: unknown) =>
    nessie(`/customers`, { method: "POST", body: JSON.stringify(body) }),
  createAccount: (customerId: string, body: unknown) =>
    nessie(`/customers/${customerId}/accounts`, { method: "POST", body: JSON.stringify(body) }),
  createBill: (accountId: string, body: unknown) =>
    nessie(`/accounts/${accountId}/bills`, { method: "POST", body: JSON.stringify(body) }),
  createMerchant: (body: unknown) =>
    nessie(`/merchants`, { method: "POST", body: JSON.stringify(body) }),
  createPurchase: (accountId: string, body: unknown) =>
    nessie(`/accounts/${accountId}/purchases`, { method: "POST", body: JSON.stringify(body) }),
};
