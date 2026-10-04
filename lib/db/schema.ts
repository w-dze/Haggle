import {
  pgTable,
  uuid,
  text,
  integer,
  bigserial,
  boolean,
  jsonb,
  timestamp,
  date,
  primaryKey,
} from "drizzle-orm/pg-core";

// Data model per PDR §5.2. Monetary values are stored in cents (integers).

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  displayName: text("display_name").notNull().default(""), // empty for anonymous check-up users
  preferredLang: text("preferred_lang").notNull(), // es | zh | ko | en
  callbackPhone: text("callback_phone"), // demo only
  nessieCustomerId: text("nessie_customer_id"),
  // Bill check-up consent flags. Inbox and bank access are read-only and mocked in the demo.
  consentInboxRead: boolean("consent_inbox_read").default(false).notNull(),
  consentBankRead: boolean("consent_bank_read").default(false).notNull(),
  consentCalls: boolean("consent_calls").default(false).notNull(),
  consentUpdatedAt: timestamp("consent_updated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const bills = pgTable("bills", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  source: text("source").notNull(), // photo | nessie
  provider: text("provider"),
  planName: text("plan_name"),
  amountCents: integer("amount_cents"),
  currency: text("currency").default("USD"),
  lineItems: jsonb("line_items"),
  promoEnd: date("promo_end"),
  accountLast4: text("account_last4"),
  rawOcr: jsonb("raw_ocr"),
  imagePath: text("image_path"), // nullable; purged after demo (§7.6)
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const caseFiles = pgTable("case_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  billId: uuid("bill_id").references(() => bills.id),
  intent: jsonb("intent"),
  currentCents: integer("current_cents"),
  targetCents: integer("target_cents"),
  walkawayCents: integer("walkaway_cents"),
  allowedConcessions: jsonb("allowed_concessions"),
  forbidden: jsonb("forbidden"),
  leverage: jsonb("leverage"),
  competitorOffers: jsonb("competitor_offers"),
  explanationI18n: jsonb("explanation_i18n"),
  status: text("status").default("draft"), // draft | locked
  findingId: text("finding_id"), // set when the case came from a bill check-up finding
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const calls = pgTable("calls", {
  id: uuid("id").primaryKey().defaultRandom(),
  caseFileId: uuid("case_file_id").references(() => caseFiles.id),
  elConversationId: text("el_conversation_id"),
  callSid: text("call_sid"),
  toNumber: text("to_number"),
  status: text("status").default("dialing"), // dialing | live | ended | failed | killed
  transcriptSource: text("transcript_source"), // realtime | poll | log_turn
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

export const transcriptLines = pgTable("transcript_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  callId: uuid("call_id").references(() => calls.id),
  seq: integer("seq").notNull(),
  speaker: text("speaker").notNull(), // agent | rep
  textEn: text("text_en"),
  textTranslated: text("text_translated"),
  lang: text("lang"),
  numbersOk: boolean("numbers_ok").default(true),
  source: text("source"), // realtime | poll | log_turn
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const approvals = pgTable("approvals", {
  id: uuid("id").primaryKey().defaultRandom(),
  callId: uuid("call_id").references(() => calls.id),
  summaryEn: text("summary_en"),
  summaryTranslated: text("summary_translated"),
  offer: jsonb("offer"),
  status: text("status").default("pending"), // pending | yes | no | timeout
  requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
  answeredAt: timestamp("answered_at", { withTimezone: true }),
});

export const outcomes = pgTable("outcomes", {
  id: uuid("id").primaryKey().defaultRandom(),
  callId: uuid("call_id").references(() => calls.id),
  result: text("result"), // agreed | no_deal | callback | killed
  oldCents: integer("old_cents"),
  newCents: integer("new_cents"),
  termMonths: integer("term_months"),
  confirmationRef: text("confirmation_ref"),
  debriefI18n: jsonb("debrief_i18n"),
  annualSavingsCents: integer("annual_savings_cents"),
});

// Append-only (§5.2, §7.3). The app DB role should be granted INSERT, SELECT only.
export const auditEvents = pgTable("audit_events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  ts: timestamp("ts", { withTimezone: true }).defaultNow().notNull(),
  actor: text("actor").notNull(), // user | intake | analyst | negotiator | system
  event: text("event").notNull(), // e.g. call.started
  callId: uuid("call_id"),
  caseFileId: uuid("case_file_id"),
  userId: uuid("user_id"),
  findingId: text("finding_id"),
  payload: jsonb("payload"),
  hash: text("hash"),
  prevHash: text("prev_hash"),
});

// --- Bill check-up -----------------------------------------------------------

// Cached bank data (Nessie, or the local fixture when Nessie is unavailable).
// Shared by every demo user of a persona; per-user state lives in findings/dismissals.
export const transactions = pgTable("transactions", {
  id: text("id").primaryKey(), // Nessie _id, or the fixture id
  persona: text("persona").notNull(), // e.g. maria
  kind: text("kind").notNull(), // purchase | bill
  merchantRaw: text("merchant_raw").notNull(),
  merchantNorm: text("merchant_norm"),
  amountCents: integer("amount_cents").notNull(),
  date: date("date").notNull(),
  status: text("status"),
  source: text("source").notNull(), // nessie | fixture
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Facts extracted from billing emails. Never the raw email body.
export const billEvents = pgTable("bill_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  persona: text("persona").notNull(),
  provider: text("provider"), // null when the sender is not in data/providers.json
  providerId: text("provider_id"),
  amountCents: integer("amount_cents"),
  previousAmountCents: integer("previous_amount_cents"),
  dueDate: date("due_date"),
  effectiveDate: date("effective_date"),
  changeType: text("change_type").notNull(), // price_increase | receipt | statement | unverified_sender
  sourceMessageId: text("source_message_id").notNull().unique(),
  trusted: boolean("trusted").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Detector output per user. The id is deterministic, so the same finding has
// the same id for every user and its explanations can be shared.
export const findings = pgTable(
  "findings",
  {
    id: text("id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    type: text("type").notNull(), // price_jump | duplicate | creeping | new_recurring | promo_expiry | outlier | bill_mismatch
    merchant: text("merchant").notNull(),
    data: jsonb("data").notNull(),
    confidence: text("confidence").notNull(), // high | medium | low
    status: text("status").default("open").notNull(), // open | dismissed | called
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.id] })],
);

export const explanations = pgTable(
  "explanations",
  {
    findingId: text("finding_id").notNull(),
    lang: text("lang").notNull(),
    body: text("body").notNull(),
    enBody: text("en_body").notNull(),
    source: text("source").notNull(), // llm | cached | template
    generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.findingId, t.lang] })],
);

export const dismissals = pgTable("dismissals", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  findingId: text("finding_id").notNull(),
  merchant: text("merchant").notNull(),
  acceptedAmountCents: integer("accepted_amount_cents").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  undoneAt: timestamp("undone_at", { withTimezone: true }),
});
