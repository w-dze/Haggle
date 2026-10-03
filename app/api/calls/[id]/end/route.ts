import { NextRequest } from "next/server";
import { ok, failMsg } from "@/lib/response";

export const runtime = "nodejs";

// POST /api/calls/:id/end — kill switch (FR-24, GR-5).
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    // TODO(A): load call -> endConversation(el_conversation_id);
    // update calls.status = "killed"; writeAudit({ event: "call.killed", callId: id }).
    return ok({ ended: id });
  } catch (err) {
    return failMsg("end_failed", String(err), 500);
  }
}
