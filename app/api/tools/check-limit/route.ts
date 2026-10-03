import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyToolSecret } from "@/lib/elevenlabs/verify";
import { checkLimit } from "@/lib/guardrails/limits";

export const runtime = "nodejs";

// POST /api/tools/check-limit — ElevenLabs server tool (GR-2, FR-15).
// The DECISION is made here on the server, never in the prompt alone.
// Returns the plain shape ElevenLabs expects: { allowed, reason }. [Verify]
const Body = z.object({
  call_id: z.string(),
  monthly_price: z.number(),
  term_months: z.number().optional(),
  concessions: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  if (!verifyToolSecret(req.headers.get("x-tool-secret"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ allowed: false, reason: "bad request" }, { status: 400 });
  }

  // TODO(A/B): load the LOCKED case file for call_id and pass real limits.
  // Fallback below is intentionally strict (deny) until wired up.
  const result = checkLimit({
    walkawayCents: 0,
    allowedConcessions: [],
    forbidden: [],
    monthlyPrice: parsed.data.monthly_price,
    termMonths: parsed.data.term_months,
    concessions: parsed.data.concessions,
  });

  // TODO: writeAudit({ actor: "negotiator", event: "tool.check_limit", callId })
  return NextResponse.json(result);
}
