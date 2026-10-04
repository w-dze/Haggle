import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, failMsg } from "@/lib/response";
import { getDb } from "@/lib/db/client";
import { calls, caseFiles } from "@/lib/db/schema";
import { writeAudit } from "@/lib/audit";
import { loadStoredCase } from "@/lib/case-files";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

// POST /api/calls — start a negotiation (Twilio is blocked). "simulated" plays
// a script; "live" runs the ElevenLabs agent in the browser with a human rep.
const Body = z.object({
  case_file_id: z.string().uuid(),
  lang: z.string(),
  mode: z.enum(["simulated", "live"]).default("simulated"),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return failMsg("bad_request", parsed.error.message, 400);

  const { mode } = parsed.data;
  try {
    const stored = await loadStoredCase(parsed.data.case_file_id);
    if (!stored) return failMsg("not_found", "Case file not found", 404);

    const db = getDb();
    const [row] = await db
      .insert(calls)
      .values({
        caseFileId: stored.id,
        toNumber: mode === "live" ? "browser" : "simulated",
        status: "dialing",
        transcriptSource: mode === "live" ? "realtime" : "queued",
      })
      .returning({ id: calls.id });

    await db.update(caseFiles).set({ status: "locked" }).where(eq(caseFiles.id, stored.id));
    await writeAudit({
      actor: "user",
      event: "call.requested",
      callId: row.id,
      caseFileId: stored.id,
      payload: { mode, lang: parsed.data.lang },
    });

    return ok({ call_id: row.id, case_file_id: stored.id, mode });
  } catch (err) {
    return failMsg("call_failed", String(err), 500);
  }
}
