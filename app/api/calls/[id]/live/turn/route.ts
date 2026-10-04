import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, failMsg } from "@/lib/response";
import { ingestLiveTurn } from "@/lib/live-call";

export const runtime = "nodejs";

// POST /api/calls/:id/live/turn — one finished turn from the browser session.
const Body = z.object({
  speaker: z.enum(["agent", "rep"]),
  text: z.string().min(1),
  lang: z.string(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return failMsg("bad_request", parsed.error.message, 400);
  try {
    await ingestLiveTurn(id, parsed.data.speaker, parsed.data.text, parsed.data.lang);
    return ok({ logged: true });
  } catch (err) {
    return failMsg("turn_failed", String(err), 500);
  }
}
