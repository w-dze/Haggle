import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, failMsg } from "@/lib/response";
import { markLive, startLiveSession } from "@/lib/live-call";

export const runtime = "nodejs";

// GET /api/calls/:id/live/session — signed ElevenLabs URL + case variables.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const session = await startLiveSession(id);
    if (!session) return failMsg("not_found", "Call not found", 404);
    return ok({ signed_url: session.signedUrl, dynamic_variables: session.dynamicVariables });
  } catch (err) {
    return failMsg("live_session_failed", String(err), 500);
  }
}

// POST /api/calls/:id/live/session — the browser connected; mark the call live.
const Body = z.object({ conversation_id: z.string() });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return failMsg("bad_request", parsed.error.message, 400);
  try {
    await markLive(id, parsed.data.conversation_id);
    return ok({ live: id });
  } catch (err) {
    return failMsg("live_session_failed", String(err), 500);
  }
}
