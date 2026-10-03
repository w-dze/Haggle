import { NextRequest } from "next/server";
import { ok, failMsg } from "@/lib/response";
import { extractBill } from "@/lib/gemini/ocr";
import { last4 } from "@/lib/guardrails/mask";

export const runtime = "nodejs";

// POST /api/bills/ocr — multipart { image, lang } -> { bill_id, extraction } (FR-2, FR-7).
// Masks the account number to last-4 before storage/return (FR-11).
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("image");
    if (!(file instanceof File)) return failMsg("no_image", "No image uploaded", 400);

    const bytes = Buffer.from(await file.arrayBuffer());
    const extraction = await extractBill({
      base64: bytes.toString("base64"),
      mimeType: file.type || "image/jpeg",
    });

    if (extraction.account_last4) {
      extraction.account_last4 = last4(extraction.account_last4);
    }

    // TODO(B): insert into bills (masked), writeAudit, return the real bill_id.
    return ok({ bill_id: "TODO", extraction });
  } catch (err) {
    return failMsg("ocr_failed", String(err), 500);
  }
}
