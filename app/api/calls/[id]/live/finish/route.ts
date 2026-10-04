import { NextRequest } from "next/server";
import { ok, failMsg } from "@/lib/response";
import { finishLiveCall } from "@/lib/live-call";

export const runtime = "nodejs";

// POST /api/calls/:id/live/finish?lang= — session closed; write the outcome.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const lang = new URL(req.url).searchParams.get("lang") ?? "en";
  try {
    await finishLiveCall(id, lang);
    return ok({ ended: id });
  } catch (err) {
    return failMsg("finish_failed", String(err), 500);
  }
}
