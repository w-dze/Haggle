import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { rm, readdir } from "node:fs/promises";
import { join } from "node:path";

// Deletes demo artifacts after judging (§7.6): bill images, and (TODO) the
// demo user's transcripts, approvals and audit trail from Neon.

async function purgeUploads() {
  const dir = join(process.cwd(), "uploads");
  try {
    const entries = await readdir(dir);
    for (const e of entries) await rm(join(dir, e), { recursive: true, force: true });
    console.log(`Purged ${entries.length} upload(s).`);
  } catch {
    console.log("No uploads directory to purge.");
  }
}

async function main() {
  await purgeUploads();
  // TODO: delete transcript_lines, approvals, outcomes, calls, bills, case_files,
  // and audit_events for DEMO_USER_ID. Keep this honest for the demo reset.
  console.log("Purge complete.");
}

main();
