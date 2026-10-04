CREATE TABLE "bill_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"persona" text NOT NULL,
	"provider" text,
	"provider_id" text,
	"amount_cents" integer,
	"previous_amount_cents" integer,
	"due_date" date,
	"effective_date" date,
	"change_type" text NOT NULL,
	"source_message_id" text NOT NULL,
	"trusted" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bill_events_source_message_id_unique" UNIQUE("source_message_id")
);
--> statement-breakpoint
CREATE TABLE "dismissals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"finding_id" text NOT NULL,
	"merchant" text NOT NULL,
	"accepted_amount_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"undone_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "explanations" (
	"finding_id" text NOT NULL,
	"lang" text NOT NULL,
	"body" text NOT NULL,
	"en_body" text NOT NULL,
	"source" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "explanations_finding_id_lang_pk" PRIMARY KEY("finding_id","lang")
);
--> statement-breakpoint
CREATE TABLE "findings" (
	"id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"merchant" text NOT NULL,
	"data" jsonb NOT NULL,
	"confidence" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "findings_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"persona" text NOT NULL,
	"kind" text NOT NULL,
	"merchant_raw" text NOT NULL,
	"merchant_norm" text,
	"amount_cents" integer NOT NULL,
	"date" date NOT NULL,
	"status" text,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "display_name" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN "finding_id" text;--> statement-breakpoint
ALTER TABLE "case_files" ADD COLUMN "finding_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "consent_inbox_read" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "consent_bank_read" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "consent_calls" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "consent_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dismissals" ADD CONSTRAINT "dismissals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;