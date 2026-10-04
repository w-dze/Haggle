import { median } from "../stats";
import type { NormalizedCharge } from "../types";

export const JUMP_RATIO = 1.15; // ≥ 1.15× (the insurance case is exactly 1.15×)
export const JUMP_MIN_CENTS = 500;
export const MIN_PRIORS = 3;
const PRIOR_WINDOW = 6;
const PERSIST_TOL = 0.05;

export type StepUp = {
  index: number; // first elevated charge
  beforeCents: number; // median of the charges before it
  priors: NormalizedCharge[];
  elevated: NormalizedCharge[]; // from the step to the latest charge
};

/**
 * Earliest step up that is still in effect: the charge is ≥ 1.15× and ≥ $5
 * above the median of up to six prior charges (at least three), and every
 * later charge stays at about that level. `floorCents` is an accepted amount
 * from a "This is normal" dismissal; nothing at or below it counts as a jump.
 */
export function findStepUp(charges: NormalizedCharge[], floorCents = 0): StepUp | null {
  for (let i = MIN_PRIORS; i < charges.length; i++) {
    const priors = charges.slice(Math.max(0, i - PRIOR_WINDOW), i);
    const base = Math.max(median(priors.map((c) => c.amountCents)), floorCents);
    const amount = charges[i].amountCents;
    if (amount < base * JUMP_RATIO || amount - base < JUMP_MIN_CENTS) continue;
    const rest = charges.slice(i);
    if (rest.every((c) => c.amountCents >= amount * (1 - PERSIST_TOL))) {
      return { index: i, beforeCents: base, priors: charges.slice(0, i), elevated: rest };
    }
  }
  return null;
}
