import { env } from "@/lib/env";
import { generateJson, loadPrompt } from "./client";
import { BillExtraction } from "@/lib/schemas";

// Bill OCR in any of es/zh/ko/en -> structured English fields (§5.5, FR-7).
// The account number is masked downstream (FR-11); OCR should already return
// only the last 4 where possible.
export async function extractBill(image: {
  base64: string;
  mimeType: string;
}): Promise<BillExtraction> {
  const prompt = loadPrompt("intake.md"); // bill extraction instructions live alongside intake
  return generateJson(
    {
      model: env.GEMINI_MODEL_FAST,
      parts: [
        { text: prompt },
        { inlineData: { mimeType: image.mimeType, data: image.base64 } },
      ],
    },
    BillExtraction,
  );
}
