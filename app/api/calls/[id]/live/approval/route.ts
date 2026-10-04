import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requestLiveApproval } from "@/lib/live-call";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/calls/:id/live/approval — backs the agent's request_user_approval
// client tool. Long-polls until the user answers the card (or 45s pass).
const Body = z.object({
  summary: z.string().min(1),
  monthly_price: z.coerce.number(),
  lang: z.string(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ approved: false, reason: "bad request" }, { status: 400 });
  }
  try {
    const result = await requestLiveApproval({
      callId: id,
      summary: parsed.data.summary,
      monthlyPrice: parsed.data.monthly_price,
      lang: parsed.data.lang,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ approved: false, reason: String(err) }, { status: 500 });
  }
}
