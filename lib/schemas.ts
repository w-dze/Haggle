import { z } from "zod";

// Core structured types exchanged between agents (PDR §5.4). All Gemini output
// is validated against these before use.

export const BillExtraction = z.object({
  provider: z.string(),
  plan_name: z.string().optional(),
  line_items: z.array(z.object({ label: z.string(), amount: z.number() })).default([]),
  total_monthly: z.number(),
  due_date: z.string().optional(),
  promo_end: z.string().optional(),
  account_last4: z.string().optional(),
  original_language: z.string().optional(),
});
export type BillExtraction = z.infer<typeof BillExtraction>;

export const Intent = z.object({
  goal: z.enum(["lower_price", "remove_fee", "downgrade", "cancel"]),
  user_words: z.string(), // original language, verbatim
  constraints: z.array(z.string()).default([]), // e.g. "no contract", "keep same speed"
});
export type Intent = z.infer<typeof Intent>;

export const CaseFile = z.object({
  account_holder_name: z.string(),
  provider: z.string(),
  service: z.string(), // "home internet"
  account_last4: z.string().length(4),
  current_monthly: z.number(),
  target_monthly: z.number(),
  walkaway_monthly: z.number(),
  issues: z.array(z.string()),
  leverage: z.array(z.string()),
  competitor_offers: z.array(
    z.object({
      provider: z.string(),
      plan: z.string(),
      monthly: z.number(),
      source: z.literal("curated_json"),
    }),
  ),
  allowed_concessions: z.array(z.string()),
  forbidden: z.array(z.string()),
});
export type CaseFile = z.infer<typeof CaseFile>;

export const Debrief = z.object({
  result: z.enum(["agreed", "no_deal", "callback", "killed"]),
  old_monthly: z.number().optional(),
  new_monthly: z.number().optional(),
  monthly_savings: z.number().optional(),
  annual_savings: z.number().optional(),
  agreed_terms: z.array(z.string()).default([]),
  next_steps: z.array(z.string()).default([]),
  confirmation_ref: z.string().optional(),
  prose: z.string(), // narrative in the user's language
});
export type Debrief = z.infer<typeof Debrief>;
