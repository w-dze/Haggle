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
npm run dev                  # http://localhost:3000 -> redirects to /en
```

Database (once DATABASE_URL is set):

```bash
npm run db:push              # push the Drizzle schema to Neon
npm run seed                 # seed Nessie demo customers
```

Other scripts: `npm run db:generate`, `npm run db:migrate`, `npm run purge`,
`npm run eval`, `npm run typecheck`.

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
