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
} from "drizzle-orm/pg-core";

// Data model per PDR §5.2. Monetary values are stored in cents (integers).

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  displayName: text("display_name").notNull(),
  preferredLang: text("preferred_lang").notNull(), // es | zh | ko
  callbackPhone: text("callback_phone"), // demo only
  nessieCustomerId: text("nessie_customer_id"),
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
  payload: jsonb("payload"),
  hash: text("hash"),
  prevHash: text("prev_hash"),
});
