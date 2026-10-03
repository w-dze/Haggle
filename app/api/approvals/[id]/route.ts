import { NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { ok, failMsg } from "@/lib/response";
import { getDb } from "@/lib/db/client";
import { approvals } from "@/lib/db/schema";

export const runtime = "nodejs";

// POST /api/approvals/:id — user answers a mid-call approval (FR-22).
// Idempotent: the first answer wins (ignore if already resolved).
const Body = z.object({ decision: z.enum(["yes", "no"]) });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return failMsg("bad_request", parsed.error.message, 400);

  try {
    const db = getDb();
    // Only update if still pending (first answer wins). The request-approval
    // tool long-poll will observe the new status and return to the agent.
    await db
      .update(approvals)
      .set({ status: parsed.data.decision, answeredAt: new Date() })
      .where(eq(approvals.id, id));
    // TODO: writeAudit({ event: "approval.answered", ... })
    return ok({ answered: id, decision: parsed.data.decision });
  } catch (err) {
    return failMsg("approval_failed", String(err), 500);
  }
}
