// Applies every .sql file in supabase/migrations (in filename order) to the
// database at DATABASE_URL. Safe to re-run: migrations use IF NOT EXISTS / guards.
//
//   node scripts/migrate.js
//
// Requires DATABASE_URL in .env (Supabase Dashboard → Settings → Database →
// Connection string → URI). This string contains your DB password, so it lives
// only in the git-ignored .env file.
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, "..", "supabase", "migrations");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error(
    "\n  Missing DATABASE_URL in .env\n" +
      "  Supabase Dashboard → Project Settings → Database → Connection string → URI\n"
  );
  process.exit(1);
}

async function main() {
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("  No migration files found.");
    return;
  }

  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log("  Connected to database.\n");

  // Track which migrations have run so each applies exactly once.
  await client.query(
    "create table if not exists schema_migrations (filename text primary key, applied_at timestamptz not null default now())"
  );

  // Baseline: if the tracking table is empty but the schema already exists
  // (e.g. 0001 was applied before tracking existed), record earlier migrations
  // as applied instead of re-running non-idempotent statements.
  const { rows: applied } = await client.query("select filename from schema_migrations");
  if (applied.length === 0) {
    const { rows: pf } = await client.query("select to_regclass('public.profiles') as t");
    if (pf[0].t) {
      await client.query("insert into schema_migrations (filename) values ($1) on conflict do nothing", [
        "0001_phase1_foundation.sql",
      ]);
      console.log("  Baselined 0001_phase1_foundation.sql (schema already present).");
    }
  }

  const done = new Set((await client.query("select filename from schema_migrations")).rows.map((r) => r.filename));

  for (const file of files) {
    if (done.has(file)) {
      console.log(`  Skipping ${file} (already applied)`);
      continue;
    }
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    process.stdout.write(`  Applying ${file} ... `);
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("insert into schema_migrations (filename) values ($1)", [file]);
      await client.query("commit");
      console.log("done");
    } catch (err) {
      await client.query("rollback");
      console.log("FAILED");
      console.error(`\n  Error in ${file}:\n  ${err.message}\n`);
      await client.end();
      process.exit(1);
    }
  }

  await client.end();
  console.log("\n  All migrations applied.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
