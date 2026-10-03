// Server-enforced spending limit (GR-2, FR-15). The negotiator must call
// check_limit before agreeing to anything; the DECISION lives here, on the
// server, never in the prompt alone.

export type LimitInput = {
  walkawayCents: number;
  allowedConcessions: string[];
  forbidden: string[];
  monthlyPrice: number; // dollars, as spoken by the rep
  termMonths?: number;
  concessions?: string[];
};

export type LimitResult = { allowed: boolean; reason: string };

export function checkLimit(input: LimitInput): LimitResult {
  const priceCents = Math.round(input.monthlyPrice * 100);

  if (priceCents > input.walkawayCents) {
    return {
      allowed: false,
      reason: `above walk-away ${(input.walkawayCents / 100).toFixed(2)}`,
    };
  }

  // Any proposed concession must be explicitly allowed and not forbidden.
  for (const c of input.concessions ?? []) {
    if (input.forbidden.some((f) => c.toLowerCase().includes(f.toLowerCase()))) {
      return { allowed: false, reason: `forbidden concession: ${c}` };
    }
    const isAllowed = input.allowedConcessions.some((a) =>
      c.toLowerCase().includes(a.toLowerCase()),
    );
    if (!isAllowed) {
      return { allowed: false, reason: `concession not pre-approved: ${c}` };
    }
  }

  // Contracts are only acceptable if a matching allowed concession permits them.
  if (input.termMonths && input.termMonths > 0) {
    const contractAllowed = input.allowedConcessions.some((a) =>
      /contract|price lock|month/i.test(a),
    );
    if (!contractAllowed) {
      return { allowed: false, reason: "contract not pre-approved" };
    }
  }

  return { allowed: true, reason: "within limits" };
}
