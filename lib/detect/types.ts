// Types for the deterministic bill check-up detector. All money is integer
// cents and all dates are YYYY-MM-DD strings. Nothing here calls an LLM.

export type Charge = {
  id: string;
  merchantRaw: string;
  amountCents: number;
  date: string;
  /** Category hint from the data source; otherwise looked up by merchant. */
  category?: string;
};

export type BankBill = {
  id: string;
  payee: string;
  amountCents: number;
  date: string;
};

/** Facts extracted from a billing email (see lib/inbox/extract.ts). */
export type BillEventFact = {
  provider: string | null;
  amountCents: number | null;
  previousAmountCents: number | null;
  effectiveDate: string | null;
  dueDate: string | null;
  changeType: string;
  sourceMessageId: string;
  trusted: boolean;
};

export type Dismissal = {
  findingId: string;
  merchant: string; // merchant key
  acceptedAmountCents: number;
};

export type DetectInput = {
  charges: Charge[];
  bills: BankBill[];
  billEvents: BillEventFact[];
  dismissals: Dismissal[];
  asOf: string;
};

export type Cadence = "weekly" | "monthly" | "annual" | "irregular";

export type NormalizedCharge = Charge & { merchant: string; display: string; category: string; day: number };

export type MerchantSeries = {
  merchant: string; // stable key, e.g. "northwind-internet"
  display: string; // "Northwind Internet"
  category: string;
  variable: boolean; // category varies legitimately (utilities, groceries…)
  cadence: Cadence;
  recurring: boolean;
  /** All charges, oldest first, including duplicates. */
  all: NormalizedCharge[];
  /** Charges with same-amount duplicates removed (what other rules analyse). */
  charges: NormalizedCharge[];
  duplicateIds: string[];
};

export type FindingType =
  | "price_jump"
  | "duplicate"
  | "creeping"
  | "new_recurring"
  | "promo_expiry"
  | "outlier"
  | "bill_mismatch";

export type Confidence = "high" | "medium" | "low";

/** Why a confidence level was chosen; rendered as plain-language notes in the UI. */
export type ConfidenceReason =
  | "variable_category"
  | "seasonal_yoy"
  | "email_notice"
  | "email_receipt"
  | "no_email";

export type Finding = {
  id: string;
  type: FindingType;
  merchant: string;
  display: string;
  category: string;
  confidence: Confidence;
  reasons: ConfidenceReason[];
  /** Typical amount before the change (null for new_recurring). */
  beforeCents: number | null;
  /** The amount that looks off (latest charge in the run). */
  afterCents: number;
  /** When the change first appeared. */
  changeDate: string;
  latestDate: string;
  /** Dates of every evidence charge, oldest first (e.g. both sides of a duplicate). */
  dates: string[];
  chargesSinceChange: number;
  extraPaidCents: number;
  evidence: { chargeIds: string[]; billIds: string[]; emailIds: string[] };
  supportingRules: FindingType[];
};

export type MerchantStatus = "normal" | "changed" | "new";

export type MerchantSummary = {
  merchant: string;
  display: string;
  category: string;
  cadence: Cadence;
  typicalCents: number; // median of the most recent charges
  lastDate: string;
  lastCents: number;
  /** Totals per calendar month for the 12 months before asOf, oldest first. */
  monthly: { month: string; cents: number }[];
  status: MerchantStatus;
  chargeIds: string[];
};

export type DetectResult = {
  asOf: string;
  merchants: MerchantSummary[];
  findings: Finding[];
};
