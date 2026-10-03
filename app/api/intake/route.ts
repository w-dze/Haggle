import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, failMsg } from "@/lib/response";
import { inferIntent } from "@/lib/gemini/intake";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";

// POST /api/intake — goal text (user's language) -> structured Intent (FR-5).
const Body = z.object({
  goal_text: z.string().min(1),
  lang: z.string(),
  bill_id: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return failMsg("bad_request", parsed.error.message, 400);

  try {
    const intent = inferIntent(parsed.data.goal_text);
    await writeAudit({
      actor: "intake",
      event: "intake.parsed",
      payload: { bill_id: parsed.data.bill_id ?? null, goal: intent.goal },
    }).catch(() => {
      /* audit is best-effort if the DB is briefly unavailable */
    });
    return ok({ intent });
  } catch (err) {
    return failMsg("intake_failed", String(err), 500);
  }
}
