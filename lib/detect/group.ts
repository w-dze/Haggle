import { categoryFor, isVariableCategory, normalizeMerchant } from "./normalize";
import { dayNumber, median } from "./stats";
import type { Cadence, Charge, MerchantSeries, NormalizedCharge } from "./types";

export const DUPLICATE_WINDOW_DAYS = 5;

export function normalizeCharges(charges: Charge[]): NormalizedCharge[] {
  return charges
    .map((c) => {
      const { key, display } = normalizeMerchant(c.merchantRaw);
      return { ...c, merchant: key, display, category: categoryFor(display, c.category), day: dayNumber(c.date) };
    })
    .sort((a, b) => a.day - b.day || a.id.localeCompare(b.id));
}

export function cadenceOf(charges: NormalizedCharge[]): Cadence {
  if (charges.length < 2) return "irregular";
  const gaps = charges.slice(1).map((c, i) => c.day - charges[i].day);
  const g = median(gaps);
  if (g >= 5 && g <= 10) return "weekly";
  if (g >= 25 && g <= 35) return "monthly";
  if (g >= 340 && g <= 390) return "annual";
  return "irregular";
}

/** Group by merchant; split out same-amount repeats inside the duplicate window. */
export function groupSeries(charges: NormalizedCharge[]): MerchantSeries[] {
  const byMerchant = new Map<string, NormalizedCharge[]>();
  for (const c of charges) byMerchant.set(c.merchant, [...(byMerchant.get(c.merchant) ?? []), c]);

  return [...byMerchant.values()].map((all) => {
    const clean: NormalizedCharge[] = [];
    const duplicateIds: string[] = [];
    for (const c of all) {
      const twin = clean.find(
        (k) => k.amountCents === c.amountCents && c.day - k.day <= DUPLICATE_WINDOW_DAYS,
      );
      if (twin) duplicateIds.push(c.id);
      else clean.push(c);
    }
    const cadence = cadenceOf(clean);
    const recurring = cadence !== "irregular" && clean.length >= (cadence === "annual" ? 2 : 3);
    const first = all[0];
    return {
      merchant: first.merchant,
      display: first.display,
      category: first.category,
      variable: isVariableCategory(first.category),
      cadence,
      recurring,
      all,
      charges: clean,
      duplicateIds,
    };
  });
}
