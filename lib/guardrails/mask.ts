// GR / FR-11: account numbers are masked to the last 4 digits before any LLM
// call, storage or display. Full numbers must never reach a prompt or log.

export function last4(accountNumber: string): string {
  const digits = accountNumber.replace(/\D/g, "");
  return digits.slice(-4).padStart(4, "0");
}

/**
 * Redacts anything that looks like a long account/card number in free text,
 * leaving only the last 4 digits. Defensive — apply to raw OCR text before it
 * is used in prompts.
 */
export function maskAccountNumbers(text: string): string {
  return text.replace(/\b(?:\d[ -]?){8,}\d\b/g, (match) => {
    const digits = match.replace(/\D/g, "");
    return `••••${digits.slice(-4)}`;
  });
}
