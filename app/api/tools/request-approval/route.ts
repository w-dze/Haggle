import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { verifyToolSecret } from "@/lib/elevenlabs/verify";
import { getDb } from "@/lib/db/client";
import { approvals } from "@/lib/db/schema";

export const runtime = "nodejs";

// POST /api/tools/request-approval — ElevenLabs server tool (FR-16, §4.5).
// Inserts a pending approval, then long-polls Neon until it is answered or 45s
// pass. A timeout counts as "No" (FR-23).
//
// [Verify V3] the server-tool timeout. If it is < ~45s, split into
// request_user_approval (returns {status:"pending", approval_id}) +
// get_approval_status polling.
const Body = z.object({
  call_id: z.string(),
  summary: z.string(),
  monthly_price: z.number().optional(),
  term_months: z.number().optional(),
});

const TIMEOUT_MS = 45_000;
const POLL_MS = 750;

export async function POST(req: NextRequest) {
  if (!verifyToolSecret(req.headers.get("x-tool-secret"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ approved: false, reason: "bad request" }, { status: 400 });
  }

  try {
    const db = getDb();
    const [row] = await db
      .insert(approvals)
      .values({
        callId: parsed.data.call_id,
        summaryEn: parsed.data.summary,
        offer: { monthly_price: parsed.data.monthly_price, term_months: parsed.data.term_months },
        status: "pending",
      })
      .returning({ id: approvals.id });
    // TODO(C): translate summary -> summaryTranslated so the modal shows the user's language.

    const deadline = Date.now() + TIMEOUT_MS;
    while (Date.now() < deadline) {
      const [current] = await db
        .select({ status: approvals.status })
        .from(approvals)
        .where(eq(approvals.id, row.id))
        .limit(1);
      if (current && current.status !== "pending") {
        return NextResponse.json({ approved: current.status === "yes", reason: current.status });
      }
      await new Promise((r) => setTimeout(r, POLL_MS));
    }

    await db.update(approvals).set({ status: "timeout" }).where(eq(approvals.id, row.id));
    return NextResponse.json({ approved: false, reason: "timeout" });
  } catch (err) {
    return NextResponse.json({ approved: false, reason: String(err) }, { status: 500 });
  }
}
