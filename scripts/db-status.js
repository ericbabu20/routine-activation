// Quick health check: does the schema exist yet, and is it seeded?
// Reads credentials from .env (never from the command line).
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;

if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY in .env");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });

const tables = [
  "profiles",
  "gyms",
  "gym_hours",
  "gym_amenities",
  "membership_plans",
  "membership_plan_gyms",
  "memberships",
  "routine_preferences",
  "notification_preferences",
  "ai_consent",
  "analytics_events",
  "audit_log",
];

const results = {};
for (const t of tables) {
  const { data, error } = await admin.from(t).select("*").limit(1);
  results[t] = error ? `MISSING (${error.code || ""} ${error.message})` : `ok (${data.length} sample row(s))`;
}

console.log("\n  Schema status:");
for (const [t, status] of Object.entries(results)) {
  console.log(`   - ${t.padEnd(24)} ${status}`);
}

const anyMissing = Object.values(results).some((r) => r.startsWith("MISSING"));
console.log(
  anyMissing
    ? "\n  → Some tables are missing. Run the migration first.\n"
    : "\n  → All Phase 1 tables exist.\n"
);
