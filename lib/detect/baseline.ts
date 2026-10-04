import type { Dismissal } from "./types";

// "This is normal" turns the accepted amount into the merchant's new baseline:
// rules ignore charges at or below it, and the dismissed finding id never
// comes back. A later rise above the accepted amount can still be flagged.
export function dismissalBaselines(dismissals: Dismissal[]) {
  const floors = new Map<string, number>();
  for (const d of dismissals) floors.set(d.merchant, Math.max(floors.get(d.merchant) ?? 0, d.acceptedAmountCents));
  return {
    floorFor: (merchant: string) => floors.get(merchant) ?? 0,
    dismissedIds: new Set(dismissals.map((d) => d.findingId)),
    dismissedMerchants: new Set(floors.keys()),
  };
}
