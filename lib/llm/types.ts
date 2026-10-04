import type { FindingFacts } from "./facts";
import type { ExplanationSections, Lang } from "./templates";

export type ExplainRequest = {
  facts: FindingFacts;
  lang: Lang;
  /** Template explanation in the target language and in English, as a grounded draft. */
  draft: ExplanationSections;
  draftEn: ExplanationSections;
};

export type BillExtractionResult = {
  provider: string;
  plan_name: string;
  total_monthly: number;
  due_date: string;
  line_items: { label: string; amount: number }[];
};

/** What every LLM provider must implement. The LLM only phrases and translates. */
export type LlmProvider = {
  name: string;
  supportsImages: boolean;
  explainFinding(req: ExplainRequest): Promise<{ body: ExplanationSections; en: ExplanationSections }>;
  translate(text: string, lang: string): Promise<string>;
  extractBillFromImage?(image: { mimeType: string; base64: string }): Promise<BillExtractionResult>;
};

export type ExplanationSource = "llm" | "cached" | "template";

export type Explanation = {
  findingId: string;
  lang: Lang;
  body: ExplanationSections;
  en: ExplanationSections;
  /** llm = generated just now; cached = stored earlier (live or pre-generated); template = deterministic fallback. */
  source: ExplanationSource;
  /** Why a template was used, for logs and the UI note. */
  fallbackReason?: string;
};
