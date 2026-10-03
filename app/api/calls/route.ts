import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, failMsg } from "@/lib/response";
import { callAllowlist } from "@/lib/env";
import { placeOutboundCall } from "@/lib/elevenlabs/calls";

export const runtime = "nodejs";

// POST /api/calls — place the outbound negotiation call (FR-12).
// Guardrails: destination allowlist (§7.3), one active call per user, and the
// case file's limit must be locked before dialing.
const Body = z.object({
  case_file_id: z.string(),
  to_number: z.string(),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return failMsg("bad_request", parsed.error.message, 400);

  const { to_number, case_file_id } = parsed.data;

  // §7.3 DoS/cost control: only call allowlisted numbers in the prototype.
  const allow = callAllowlist();
  if (allow.length && !allow.includes(to_number)) {
    return failMsg("not_allowlisted", "Destination number is not on the allowlist", 403);
  }

  try {
    // TODO(A/B): load locked case file, reject if a live call already exists,
    // flatten the case file to dynamic variables (§5.4), insert calls row,
    // writeAudit(call.requested).
    const dynamicVariables: Record<string, string> = {
      call_id: "TODO",
      // holder_name, provider, service, account_last4, current_monthly,
      // target_monthly, walkaway_monthly, issues, leverage, competitor_offers,
      // allowed_concessions, forbidden — see §5.4.
    };

    const result = await placeOutboundCall({ toNumber: to_number, dynamicVariables });
    // TODO(A): persist conversation_id / call_sid, writeAudit(call.started).
    return ok({ call_id: "TODO", conversation_id: result.conversation_id, case_file_id });
  } catch (err) {
    return failMsg("call_failed", String(err), 500);
  }
}
