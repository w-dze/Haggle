import providersJson from "@/data/providers.json";

// Verified provider directory (data/providers.json). The only source of phone
// numbers Haggle will use; numbers that appear in emails are never trusted.
export type Provider = (typeof providersJson.providers)[number];

export const PROVIDERS: Provider[] = providersJson.providers;

export function providerByEmailDomain(domain: string, list: Provider[] = PROVIDERS): Provider | undefined {
  const d = domain.toLowerCase();
  return list.find((p) => p.email_domains.includes(d));
}

export function providerByName(name: string, list: Provider[] = PROVIDERS): Provider | undefined {
  const n = name.toLowerCase();
  return list.find((p) => p.name.toLowerCase() === n);
}
