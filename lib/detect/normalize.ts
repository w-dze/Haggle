import aliasesJson from "@/data/merchant_aliases.json";
import categoriesJson from "@/data/merchant_categories.json";

// Statement text is noisy ("STREAMFLIX.COM 866-555-0110", "FRESHMART #1234").
// Clean it, then map to a canonical merchant via data/merchant_aliases.json.

const NOISE_WORDS = new Set([
  "inc", "llc", "co", "corp", "autopay", "auto", "pay", "pmt", "payment", "bill",
  "recurring", "purchase", "pos", "debit", "ach", "online", "www",
]);

const ALIASES: { match: string; name: string }[] = aliasesJson.aliases;
const CATEGORIES: Record<string, string> = categoriesJson.merchants;
const VARIABLE = new Set<string>(categoriesJson.variable_categories);

export function cleanStatementText(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/g, " ") // phone numbers
    .replace(/\.(com|net|org|io)\b/g, " ")
    .replace(/[#*&/\\_,.:;()'"!-]/g, " ")
    .replace(/\b\d+\b/g, " ") // store numbers, reference numbers
    .split(/\s+/)
    .filter((w) => w && !NOISE_WORDS.has(w))
    .join(" ")
    .trim();
}

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

export function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Canonical merchant for a raw statement string or provider name. */
export function normalizeMerchant(raw: string): { key: string; display: string } {
  const cleaned = cleanStatementText(raw);
  const alias = ALIASES.find((a) => cleaned.includes(a.match));
  const display = alias ? alias.name : titleCase(cleaned || raw.trim());
  return { key: slug(display), display };
}

export function categoryFor(display: string, hint?: string): string {
  return hint ?? CATEGORIES[display] ?? "other";
}

export function isVariableCategory(category: string): boolean {
  return VARIABLE.has(category);
}
