// One-off verification: creating an auth user should auto-provision a profile +
// default preference rows (handle_new_user trigger). Cleans up after itself.
// Reads credentials from .env.
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

const email = `verify+${Date.now()}@example.com`;
let userId;
try {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: "test-password-123",
    email_confirm: true,
    user_metadata: { name: "Verify Bot" },
  });
  if (error) throw error;
  userId = data.user.id;
  console.log("  created auth user:", userId);

  // Give the trigger a beat.
  await new Promise((r) => setTimeout(r, 400));

  for (const t of ["profiles", "notification_preferences", "ai_consent"]) {
    const { data: row, error: e } = await admin.from(t).select("*").eq(t === "profiles" ? "id" : "user_id", userId).maybeSingle();
    console.log(`  ${t.padEnd(24)} ${e ? "ERROR " + e.message : row ? "auto-created ✓" : "MISSING ✗"}`);
  }
} finally {
  if (userId) {
    await admin.auth.admin.deleteUser(userId);
    console.log("  cleaned up test user");
  }
}
