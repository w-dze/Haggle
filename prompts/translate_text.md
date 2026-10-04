# Translate UI text

Translate the given English text into `target_language` for a bill check-up app.

Rules:
- Preserve every number and dollar amount exactly as written (e.g. `$89.00`).
- Keep provider and plan names in English.
- Plain, calm language. No added words, opinions or advice.
- Return JSON: { "text": "<translation>" }.
