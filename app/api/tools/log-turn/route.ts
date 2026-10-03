import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyToolSecret } from "@/lib/elevenlabs/verify";
import { ingestTurn } from "@/lib/elevenlabs/transcript";

export const runtime = "nodejs";

// POST /api/tools/log-turn — Fallback B transcript transport (§4.6).
// Only used if realtime events / polling can't deliver turns in time. Text is
// the agent's paraphrase, so mark it "log_turn" (shown as agent-reported).
const Body = z.object({
  call_id: z.string(),
  speaker: z.enum(["agent", "rep"]),
  text: z.string(),
  lang: z.string().default("es"),
});

export async function POST(req: NextRequest) {
  if (!verifyToolSecret(req.headers.get("x-tool-secret"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    await ingestTurn(parsed.data.call_id, parsed.data.speaker, parsed.data.text, "log_turn", parsed.data.lang);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, reason: String(err) }, { status: 500 });
  }
}
