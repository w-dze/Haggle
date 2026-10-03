import { NextRequest } from "next/server";
import { ok, failMsg, failGemini } from "@/lib/response";
import { extractBill } from "@/lib/gemini/ocr";
import { last4 } from "@/lib/guardrails/mask";
import { getDb } from "@/lib/db/client";
import { bills } from "@/lib/db/schema";
import { writeAudit } from "@/lib/audit";
import { asDateOnly, dollarsToCents } from "@/lib/money";

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

    const db = getDb();
    const [row] = await db
      .insert(bills)
      .values({
        source: "photo",
        provider: extraction.provider,
        planName: extraction.plan_name ?? null,
        amountCents: dollarsToCents(extraction.total_monthly),
        currency: "USD",
        lineItems: extraction.line_items,
        promoEnd: asDateOnly(extraction.promo_end),
        accountLast4: extraction.account_last4 ?? null,
        rawOcr: extraction,
        imagePath: null,
      })
      .returning({ id: bills.id });

    await writeAudit({
      actor: "intake",
      event: "bill.extracted",
      payload: { bill_id: row.id, provider: extraction.provider },
    });

    return ok({ bill_id: row.id, extraction });
  } catch (err) {
    return failGemini(err, "ocr_failed");
  }
}
