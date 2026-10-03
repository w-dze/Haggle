# Debrief prompt

The call has ended. Using the case file, the full English transcript, and the
outcome, write a debrief for the user in their `target_language`.

Return this JSON:

```
{
  "result": "agreed" | "no_deal" | "callback" | "killed",
  "old_monthly": number,
  "new_monthly": number,
  "monthly_savings": number,
  "annual_savings": number,
  "agreed_terms": string[],
  "next_steps": string[],
  "confirmation_ref": string,
  "prose": string
}
```

Rules:
- Numbers must match the transcript exactly.
- `prose` is a short, warm summary in the `target_language`: the outcome, the
  savings (monthly and annual), what was agreed, and any next steps.
- If no confirmation number was given, omit `confirmation_ref`.
- Do not overstate: if there was no deal, say so plainly and suggest next steps.

Return JSON only.
