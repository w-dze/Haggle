import type { ExplanationSections } from "./templates";

// Deterministic checks on LLM output. An explanation is rejected (and the
// template used instead) if any number in it is not in the finding's fact
// sheet, if it uses accusatory wording, or if the translated and English
// versions don't line up paragraph for paragraph.

/** Numeric values in text, reading "1,450.00", "1.450", "89,00" and ISO dates. */
export function numbersIn(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/\d+(?:[.,]\d+)*/g)) {
    const tok = m[0];
    let v: number;
    if (/^\d{1,3}([.,]\d{3})+$/.test(tok)) v = Number(tok.replace(/[.,]/g, "")); // thousands separators
    else if (/^\d+[.,]\d{1,2}$/.test(tok)) v = Number(tok.replace(",", ".")); // decimal
    else if (/^\d{1,3}(,\d{3})+\.\d{1,2}$/.test(tok)) v = Number(tok.replace(/,/g, "")); // 1,450.00
    else if (/^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(tok)) v = Number(tok.replace(/\./g, "").replace(",", ".")); // 1.450,00
    else v = Number(tok.replace(/[.,]/g, ""));
    if (!Number.isNaN(v)) out.push(v);
  }
  // Chinese numerals used as counts or amounts ("三个月", "两次", "五美元").
  // Only next to a unit, because 一/两 also appear inside ordinary words.
  const cjk: Record<string, number> = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  for (const m of text.matchAll(/([一二两三四五六七八九十])(?=个月|次|笔|美元|元|年|天|周)/g)) out.push(cjk[m[1]]);
  return out;
}

const BANNED: RegExp[] = [
  /\bunfair\b/i, /overcharg/i, /rip[- ]?off/i, /\bscam/i, /\bfraud/i, /\billegal/i, /\bcheat/i,
  /injust/i, /abusiv/i, /estafa/i, /fraude/i, /ilegal/i, /cobro excesivo/i, /sobrecobr/i,
  /不公平/, /多收/, /欺诈/, /诈骗/, /违法/, /乱收费/, /坑/,
  /불공정/, /부당/, /사기/, /불법/, /과다 ?청구/, /바가지/,
  // Phone numbers and links never come from the model.
  /\bhttps?:\/\//i, /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/,
];

export type Validation = { ok: true } | { ok: false; reason: string };

function allText(s: ExplanationSections): string[] {
  return [...s.what, ...s.causes, ...s.actions, ...s.questions];
}

export function validateSections(s: ExplanationSections, allowed: number[]): Validation {
  const close = (v: number) => allowed.some((a) => Math.abs(a - v) < 0.005);
  for (const text of allText(s)) {
    for (const re of BANNED) if (re.test(text)) return { ok: false, reason: `banned wording ${re} in "${text}"` };
    for (const n of numbersIn(text)) if (!close(n)) return { ok: false, reason: `number ${n} not in finding data: "${text}"` };
  }
  if (!s.what.length) return { ok: false, reason: "empty what-changed section" };
  return { ok: true };
}

export function validatePair(body: ExplanationSections, en: ExplanationSections, allowed: number[]): Validation {
  for (const k of ["what", "causes", "actions", "questions"] as const) {
    if (body[k].length !== en[k].length) return { ok: false, reason: `${k}: ${body[k].length} paragraphs vs ${en[k].length} in English` };
  }
  const a = validateSections(body, allowed);
  if (!a.ok) return a;
  return validateSections(en, allowed);
}
