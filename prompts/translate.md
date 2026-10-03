# Translation prompt

Translate ONE line of a live phone call from English into the `target_language`.

Rules:
- Preserve every number and currency amount EXACTLY (e.g. `$72`, `12 months`).
  Do not round, convert currencies, or restate figures.
- Keep provider names, plan names, and technical terms (e.g. "Mbps") in English.
- Match the register of a customer-service call: natural and clear, not literal.
- Use the previous lines only as context for pronouns and references.
- Output the translated line only. No quotes, no labels, no commentary.
