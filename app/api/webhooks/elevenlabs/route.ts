import { NextRequest, NextResponse } from "next/server";
import { verifyWebhook } from "@/lib/elevenlabs/verify";

export const runtime = "nodejs";

// POST /api/webhooks/elevenlabs — post-call webhook (§4.4, §7.3).
// HMAC-verified. Carries the full transcript + analysis after the call ends.
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig =
    req.headers.get("elevenlabs-signature") ?? req.headers.get("x-elevenlabs-signature");

  if (!verifyWebhook(raw, sig)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  try {
    // const payload = JSON.parse(raw);
    // TODO(A/B): mark call ended, run writeDebrief(), insert outcomes,
    // writeAudit({ event: "call.completed" }), publish SSE "debrief".
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, reason: String(err) }, { status: 500 });
  }
}
