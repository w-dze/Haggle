import { NextRequest } from "next/server";
import { ok, failMsg } from "@/lib/response";
import { killSimulatedCall } from "@/lib/simulate-call";

export const runtime = "nodejs";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    await killSimulatedCall(id);
    return ok({ ended: id });
  } catch (err) {
    return failMsg("end_failed", String(err), 500);
  }
}
