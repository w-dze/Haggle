import { createHash } from "node:crypto";
import { desc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { auditEvents } from "@/lib/db/schema";

// Append-only audit trail with a tamper-evident hash chain (GR-4, §5.2, §7.3).
// hash = sha256(prev_hash || row_json).

export type AuditActor = "user" | "intake" | "analyst" | "negotiator" | "system";

export type AuditInput = {
  actor: AuditActor;
  event: string; // e.g. "call.started"
  callId?: string;
  caseFileId?: string;
  userId?: string;
  findingId?: string;
  payload?: unknown;
};

export async function writeAudit(input: AuditInput): Promise<void> {
  const db = getDb();

  const [latest] = await db
    .select({ hash: auditEvents.hash })
    .from(auditEvents)
    .orderBy(desc(auditEvents.id))
    .limit(1);

  const prevHash = latest?.hash ?? "GENESIS";
  const row = {
    actor: input.actor,
    event: input.event,
    callId: input.callId ?? null,
    caseFileId: input.caseFileId ?? null,
    payload: input.payload ?? null,
  };
  // Bill check-up links are optional columns; keep them out of the hashed row
  // when unset so existing hashes are computed exactly as before.
  const links = {
    ...(input.userId ? { userId: input.userId } : {}),
    ...(input.findingId ? { findingId: input.findingId } : {}),
  };
  const hash = createHash("sha256")
    .update(prevHash + JSON.stringify({ ...row, ...links }))
    .digest("hex");

  await db.insert(auditEvents).values({ ...row, ...links, hash, prevHash });
}
