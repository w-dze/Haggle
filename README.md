# Haggle

> Speak to it in your language. It negotiates in English on your behalf.

People with limited English proficiency often pay more for recurring services
(internet, phone, insurance) because the negotiation is built for fluent English
speakers. Haggle reads your bill and explains it in your language, works out a
fair target price, calls the provider in English for you, and streams the call
to your screen as live translated subtitles, asking for your approval before
agreeing to anything you haven't authorized.

User languages: **Spanish, Mandarin, Korean**. The negotiation call itself is in
**English**.

Full design: see [PDR.md](PDR.md).

## Stack

- **Next.js 15** (App Router) + TypeScript + Tailwind CSS v4
- **Gemini** (`@google/genai`) — OCR, intent, analysis, translation, debrief
- **ElevenLabs Agents** — multilingual voice agent + outbound telephony
- **Neon Postgres** + **Drizzle ORM** — case files, calls, transcripts, approvals, audit trail
- **Nessie** (Capital One mock banking) — account/bill/payment history
- **Zod** — validates all model output, tool payloads and env vars

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in keys (see Appendix A of PDR.md)
npm run dev                  # http://localhost:3000 (site); the app is at /demo or /en
```

Database (once DATABASE_URL is set). Schema changes are committed migrations in `drizzle/`:

```bash
npm run db:migrate           # apply migrations (fresh database)
npm run seed                 # seed Nessie (bill check-up persona) and load Neon
```

If your database was created earlier with `db:push`, run `npm run db:baseline`
once before `db:migrate`. It records `0000_baseline` as already applied, so only
the newer migrations run.

### Bill check-up demo data

- `npm run seed` creates "Maria" in Nessie with 12 months of purchases and bills
  (24 months for the electric bill), then loads Neon. The es/zh/ko intake demo
  personas in `data/nessie_demo.json` are kept; add `-- --personas` to recreate them.
- The same deterministic generator (`lib/persona/generate.ts`) writes
  `data/fixtures/maria.json`. If Nessie is unreachable or not seeded, the app
  falls back to it automatically and logs `[data-source] using fixture: <reason>`.
  Force a source with `DATA_SOURCE=nessie|fixture`.
- Nessie stores purchase amounts as whole dollars. When a Nessie purchase matches
  the fixture on date, merchant and dollars, the cents are restored from the
  fixture, and the log says how many.
- The demo inbox (`data/fixtures/inbox.json`) is read-only. Only extracted fields
  (provider, amounts, dates, change type, message id) are stored in `bill_events`.
  Senders outside `data/providers.json` are stored as untrusted with nothing extracted.

Reset the demo to its seeded state:

```bash
npm run reset-demo           # clears findings, dismissals, LLM explanations and
                             # finding-linked cases/calls; reloads bank + inbox data
```

The audit log is append-only and is never cleared. For a full snapshot reset,
use a Neon branch: seed `main`, create a branch once with
`neonctl branches create --name demo --parent main`, point `DATABASE_URL` at
`demo`, and restore it any time with `neonctl branches reset demo --parent`.

### Bill check-up dashboard

After choosing a language once, users land on `/[lang]/dashboard`. It shows what
looks off in their recurring charges, plus their typical charges with a 12-month chart.

- **Detection is deterministic** (`lib/detect/`, unit-tested). It covers price jumps,
  duplicates, creeping fees, new subscriptions, promo endings, outliers and
  bill/payment mismatches, each with a confidence level. Seasonal and variable bills
  are downgraded. `npm run eval:detector` (or `/eval`, linked under the demo phone)
  scores it on labeled synthetic data.
- **Explanations** come from `lib/llm.ts`, which is provider-agnostic. `LLM_PROVIDER=xai`
  uses Grok with the key read from server env. The model only rewords and translates a
  draft built from the finding's numbers. Every number is checked against the finding;
  if one doesn't match, a template is shown instead. Order: Neon cache, then
  `data/explanations.seed.json`, then the LLM, then the template. The UI labels
  saved and template explanations.
- **`npm run pregen`** pre-generates explanations for every seeded finding in
  en/es/zh/ko, so the demo works when the API is down. Run it again after
  changing the seed or the templates.
- **"This is normal"** stores a dismissal. The amount becomes the merchant's
  baseline, and Undo is available. **"Call about this"** creates a pre-filled case
  (target = previous typical price) and hands off to the existing case → call → debrief flow.
- **Receipts and the audit log** are at `/[lang]/receipts` and `/[lang]/audit`.
- **Demo mode** (`?mock=1`, used by the /demo phone) uses only the fixture and the
  pre-generated explanations. It needs no database and no API, and saves nothing.
- **Translations:** the strings and templates added for this feature are listed in
  `messages/review-status.json` until a native speaker has reviewed them.

Other scripts: `npm run db:generate`, `npm run seed:fixture`, `npm test`,
`npm run pregen`, `npm run purge`, `npm run eval`, `npm run typecheck`.

## Project layout

```
app/[lang]/        language-scoped screens (picker, intake, case, call, debrief, history)
app/api/           intake, bills/ocr, case-files, calls, calls/:id/stream (SSE),
                   approvals, tools/* (ElevenLabs server tools), webhooks
lib/               env, db (schema+client), gemini/*, nessie, elevenlabs/*,
                   guardrails/* (limits, mask, numbers), audit, bus, schemas
prompts/           versioned agent prompts
data/              competitor_plans.json (curated), sample_bills/
messages/          en/es/zh/ko UI strings
scripts/           seed-nessie, purge, eval
```

## Guardrails (not optional — see PDR §3.3)

Because the user can't follow the English call in real time, these are product
requirements enforced on the **server**, not just in the prompt:

- AI disclosure in the agent's first message
- Server-enforced walk-away limit (`check_limit`)
- Mid-call user approval for anything above the limit (`request_user_approval`)
- No credentials ever collected or spoken
- Append-only, hash-chained audit trail
- Kill switch
- Destination allowlist (the prototype only calls the rep teammate's phone)

## Honesty notes (for judges)

- **Mock data.** Nessie is mock banking data; no real accounts or money.
- **Curated competitor prices.** `data/competitor_plans.json` is hand-made, not
  live market data, and is clearly labeled as such.
- **The rep is a teammate.** During the demo, a teammate plays the provider rep
  on a real phone.

## Responsible design (not legal advice)

Haggle places calls *to businesses* on a consumer's behalf, at their request.
The agent always discloses it is an AI, states the call is transcribed, never
handles identity verification (it defers to the account holder), and makes no
commitment beyond what the user pre-authorized. A production version would need
legal review of AI-voiced-call and recording-consent rules, a privacy policy,
and data-retention limits. See PDR §7.5.

## Status

Scaffold per PDR §5.1. Many routes/lib functions are typed stubs with `TODO`s
pointing at the owner and the relevant PDR section. See PDR Appendix D for the
hour 0–2 `[Verify]` list to confirm against live vendor docs before building.
