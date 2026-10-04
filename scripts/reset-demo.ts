import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

// Reset the bill check-up demo to its seeded state:
// - clears per-user check-up state (findings, dismissals, LLM-written explanations)
// - removes cases that came from findings, and their calls
// - reloads cached transactions and extracted inbox facts
// Pre-generated (cached) explanations are kept. The audit log is append-only and
// hash-chained, so reset never deletes from it. Other tables (bills, calls from
// the intake flow, intake case files, users) are not touched.
//
//   npm run reset-demo
//
// For a full snapshot reset, use a Neon branch instead (see README).

async function main() {
  const { isNotNull, eq, inArray } = await import("drizzle-orm");
  const { getDb } = await import("../lib/db/client");
  const { schema } = await import("../lib/db/client");
  const { loadPersonaData } = await import("../lib/data-source");
  const { reloadPersonaData } = await import("../lib/checkup/store");
  const db = getDb();

  const findingCases = await db
    .select({ id: schema.caseFiles.id })
    .from(schema.caseFiles)
    .where(isNotNull(schema.caseFiles.findingId));
  const caseIds = findingCases.map((c) => c.id);

  if (caseIds.length) {
    // Calls and their children reference case_files, so delete bottom-up.
    const callRows = await db
      .select({ id: schema.calls.id })
      .from(schema.calls)
      .where(inArray(schema.calls.caseFileId, caseIds));
    const callIds = callRows.map((c) => c.id);
    if (callIds.length) {
      await db.delete(schema.transcriptLines).where(inArray(schema.transcriptLines.callId, callIds));
      await db.delete(schema.approvals).where(inArray(schema.approvals.callId, callIds));
      await db.delete(schema.outcomes).where(inArray(schema.outcomes.callId, callIds));
      await db.delete(schema.calls).where(inArray(schema.calls.id, callIds));
    }
    await db.delete(schema.caseFiles).where(inArray(schema.caseFiles.id, caseIds));
  }

  await db.delete(schema.dismissals);
  await db.delete(schema.findings);
  await db.delete(schema.explanations).where(eq(schema.explanations.source, "llm"));

  const loaded = await loadPersonaData({ fresh: true, timeoutMs: 15000 });
  const counts = await reloadPersonaData(db, loaded);

  console.log(`Removed ${caseIds.length} finding-linked case(s) and their calls.`);
  console.log(`Cleared findings, dismissals and LLM explanations (audit log kept: append-only).`);
  console.log(`Reloaded from ${loaded.source} (${loaded.reason}): ${counts.transactions} transactions, ${counts.billEvents} bill events.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
