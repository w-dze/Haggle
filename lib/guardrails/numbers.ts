// Number-integrity check (§5.7). A wrong number in a negotiation can do real
// harm, so numbers get a deterministic check on top of the LLM translation.

// Map of CJK numerals to arabic, enough for prices/terms (0-99,999 range).
const CJK_DIGITS: Record<string, number> = {
  "零": 0, "〇": 0, "一": 1, "二": 2, "两": 2, "三": 3, "四": 4,
  "五": 5, "六": 6, "七": 7, "八": 8, "九": 9,
  // Korean sino-numerals
  "영": 0, "일": 1, "이": 2, "삼": 3, "사": 4, "오": 5, "육": 6, "칠": 7, "팔": 8, "구": 9,
};
const CJK_UNITS: Record<string, number> = {
  "十": 10, "百": 100, "千": 1000, "万": 10000,
  "십": 10, "백": 100, "천": 1000, "만": 10000,
};

/** Best-effort conversion of a CJK numeral run to a number. */
function cjkToNumber(s: string): number | null {
  let total = 0;
  let current = 0;
  let matched = false;
  for (const ch of s) {
    if (ch in CJK_DIGITS) {
      current = CJK_DIGITS[ch];
      matched = true;
    } else if (ch in CJK_UNITS) {
      const unit = CJK_UNITS[ch];
      total += (current === 0 ? 1 : current) * unit;
      current = 0;
      matched = true;
    } else {
      return matched ? null : null;
    }
  }
  return matched ? total + current : null;
}

/** Extracts the multiset of numeric values mentioned in a piece of text. */
export function extractNumbers(text: string): number[] {
  const out: number[] = [];
  // Arabic numerals (handles $72, 72, 1,200, 59.99).
  for (const m of text.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    const n = Number(m[0].replace(/,/g, ""));
    if (!Number.isNaN(n)) out.push(n);
  }
  // CJK numeral runs.
  for (const m of text.matchAll(/[零〇一二两三四五六七八九十百千万영일이삼사오육칠팔구십백천만]+/g)) {
    const n = cjkToNumber(m[0]);
    if (n !== null && n > 0) out.push(n);
  }
  return out.sort((a, b) => a - b);
}

/** True if both strings mention the same multiset of numbers. */
export function numbersMatch(a: string, b: string): boolean {
  const na = extractNumbers(a);
  const nb = extractNumbers(b);
  if (na.length !== nb.length) return false;
  return na.every((v, i) => v === nb[i]);
}
