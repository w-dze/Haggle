import { NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ok, failMsg, failGemini } from "@/lib/response";
import { buildCaseFile } from "@/lib/gemini/analyst";
import { inferIntent } from "@/lib/gemini/intake";
import { buildLocalCaseFile } from "@/lib/case-file-local";
import { isOverloaded, isQuotaError } from "@/lib/gemini/client";
import type { NessieCustomer, NessiePurchase } from "@/lib/nessie/types";
import { BillExtraction, Intent } from "@/lib/schemas";
import { getDb } from "@/lib/db/client";
import { bills, caseFiles } from "@/lib/db/schema";
import { writeAudit } from "@/lib/audit";
import { dollarsToCents } from "@/lib/money";
import { nessieClient } from "@/lib/nessie/client";

export const runtime = "nodejs";

// POST /api/case-files — bill + intent (+ optional Nessie customer) -> CaseFile
// + explanation in the user's language (FR-9, FR-10).
const Body = z.object({
  bill_id: z.string().uuid(),
  intent: Intent.optional(),
  goal_text: z.string().min(1).optional(),
  lang: z.string(),
  nessie_customer_id: z.string().optional(),
  prefer_local: z.boolean().optional(),
});

function extractionFromBill(row: typeof bills.$inferSelect): BillExtraction {
  const fromRaw = BillExtraction.safeParse(row.rawOcr);
  if (fromRaw.success) {
    return {
      ...fromRaw.data,
      account_last4: fromRaw.data.account_last4 || row.accountLast4 || "0000",
    };
  }
  return {
    provider: row.provider ?? "Unknown",
    plan_name: row.planName ?? undefined,
    line_items: Array.isArray(row.lineItems)
      ? (row.lineItems as { label: string; amount: number }[])
      : [],
    total_monthly: (row.amountCents ?? 0) / 100,
    promo_end: row.promoEnd ?? undefined,
    account_last4: row.accountLast4 || "0000",
  };
}

async function loadNessie(customerId: string): Promise<unknown | undefined> {
  try {
    const customer = await nessieClient.getCustomer(customerId);
    const accounts = (await nessieClient.getAccounts(customerId)) as Array<{ _id?: string }>;
    const firstId = accounts[0]?._id;
    const extra = firstId
      ? {
          bills: await nessieClient.getBills(firstId).catch(() => []),
          purchases: await nessieClient.getPurchases(firstId).catch(() => []),
        }
      : {};
    return { customer, accounts, ...extra };
  } catch {
    return undefined;
  }
}

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return failMsg("bad_request", parsed.error.message, 400);

  try {
    const db = getDb();
    const [bill] = await db.select().from(bills).where(eq(bills.id, parsed.data.bill_id)).limit(1);
    if (!bill) return failMsg("not_found", "Bill not found", 404);

    const intent =
      parsed.data.intent ??
      (parsed.data.goal_text ? inferIntent(parsed.data.goal_text) : null);
    if (!intent) return failMsg("bad_request", "intent or goal_text is required", 400);

    const extraction = extractionFromBill(bill);
    if (!extraction.account_last4) extraction.account_last4 = "0000";

    const competitorPlans = JSON.parse(
      readFileSync(join(process.cwd(), "data", "competitor_plans.json"), "utf8"),
    );

    const nessie = parsed.data.nessie_customer_id
      ? await loadNessie(parsed.data.nessie_customer_id)
      : undefined;

    const nessieHolder =
      nessie && typeof nessie === "object" && "customer" in nessie
        ? `${(nessie.customer as NessieCustomer).first_name} ${(nessie.customer as NessieCustomer).last_name}`
        : undefined;
    const onTimeMonths =
      nessie && typeof nessie === "object" && "purchases" in nessie
        ? ((nessie.purchases as NessiePurchase[]) ?? []).filter((p) => p.status === "completed").length
        : 0;

    const local = () =>
      buildLocalCaseFile({
        extraction,
        intent,
        holderName: nessieHolder,
        onTimeMonths,
        competitorPlans,
        targetLang: parsed.data.lang,
      });

    let result = local();
    if (!parsed.data.prefer_local) {
      try {
        result = await buildCaseFile({
          extraction,
          intent,
          nessie,
          competitorPlans,
          targetLang: parsed.data.lang,
        });
      } catch (err) {
        if (!isQuotaError(err) && !isOverloaded(err)) throw err;
        result = local();
      }
    }

    const [row] = await db
      .insert(caseFiles)
      .values({
        billId: bill.id,
        intent,
        currentCents: dollarsToCents(result.case_file.current_monthly),
        targetCents: dollarsToCents(result.case_file.target_monthly),
        walkawayCents: dollarsToCents(result.case_file.walkaway_monthly),
        allowedConcessions: result.case_file.allowed_concessions,
        forbidden: result.case_file.forbidden,
        leverage: result.case_file.leverage,
        competitorOffers: result.case_file.competitor_offers,
        explanationI18n: {
          [parsed.data.lang]: result.explanation,
          case_file: result.case_file,
        },
        status: "draft",
      })
      .returning({ id: caseFiles.id });

    await writeAudit({
      actor: "analyst",
      event: "case.created",
      caseFileId: row.id,
      payload: { bill_id: bill.id, provider: result.case_file.provider },
    });

    return ok({
      case_file_id: row.id,
      case_file: result.case_file,
      explanation: result.explanation,
    });
  } catch (err) {
    return failGemini(err, "analyst_failed");
  }
}
