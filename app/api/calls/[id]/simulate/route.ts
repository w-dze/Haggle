import { NextRequest } from "next/server";
import { ok, failMsg } from "@/lib/response";
import { playSimulatedCall } from "@/lib/simulate-call";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const lang = new URL(req.url).searchParams.get("lang") ?? "es";
  try {
    await playSimulatedCall(id, lang);
    return ok({ played: id });
  } catch (err) {
    return failMsg("simulate_failed", String(err), 500);
  }
}
