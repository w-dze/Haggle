import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

// One-time step for a database that was created with `db:push` (before this
// repo had migrations). Records drizzle/0000_baseline.sql as already applied
// so `npm run db:migrate` only runs the migrations after it.
//
//   npm run db:baseline && npm run db:migrate
//
// Safe to re-run: it does nothing if any migration is already recorded, or if
// the database has no tables yet (then plain `db:migrate` creates everything).

async function main() {
  const { neon } = await import("@neondatabase/serverless");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = neon(url);

  const journal = JSON.parse(readFileSync(join(process.cwd(), "drizzle", "meta", "_journal.json"), "utf8")) as {
    entries: { idx: number; tag: string; when: number }[];
  };
  const baseline = journal.entries.find((e) => e.idx === 0);
  if (!baseline) throw new Error("No baseline entry in drizzle/meta/_journal.json");

  const [{ exists }] = (await sql`select to_regclass('public.users') is not null as exists`) as { exists: boolean }[];
  if (!exists) {
    console.log("Empty database: skip the baseline and run `npm run db:migrate`.");
    return;
  }

  await sql`create schema if not exists drizzle`;
  await sql`create table if not exists drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint)`;
  const recorded = (await sql`select count(*)::int as n from drizzle.__drizzle_migrations`) as { n: number }[];
  if (recorded[0].n > 0) {
    console.log("Migrations already recorded; nothing to do.");
    return;
  }

  // Same hash drizzle's migrator computes: sha256 of the whole .sql file.
  const query = readFileSync(join(process.cwd(), "drizzle", `${baseline.tag}.sql`)).toString();
  const hash = createHash("sha256").update(query).digest("hex");
  await sql`insert into drizzle.__drizzle_migrations (hash, created_at) values (${hash}, ${baseline.when})`;
  console.log(`Recorded ${baseline.tag} as applied. Now run: npm run db:migrate`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
