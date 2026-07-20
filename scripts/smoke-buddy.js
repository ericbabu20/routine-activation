// End-to-end smoke test for Trusted Buddy (two members) + account deletion.
// Creates throwaway users, drives the full invite → accept → support → confirm
// → disconnect flow, checks the privacy matrix, and verifies account deletion.
// Cleans up after itself. Run: node scripts/smoke-buddy.js
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.SMOKE_BASE || "http://localhost:3001";
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const pubKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

let pass = 0, fail = 0;
const cleanup = [];
function ok(name, cond, extra = "") { (cond ? pass++ : fail++); console.log(`  ${cond ? "✓" : "✗"} ${name}${extra ? " — " + extra : ""}`); }

async function makeUser(tag) {
  const email = `smoke-${tag}+${Date.now()}@example.com`;
  const password = "smoke-password-123";
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name: tag } });
  if (created.error) throw created.error;
  cleanup.push(created.data.user.id);
  const pub = createClient(process.env.SUPABASE_URL, pubKey, { auth: { persistSession: false } });
  await new Promise((r) => setTimeout(r, 300));
  const signIn = await pub.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  return { id: created.data.user.id, email, token: signIn.data.session.access_token };
}

function apiAs(token) {
  return async (path, method = "GET", body) => {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    let json = null; try { json = await res.json(); } catch { /* none */ }
    return { status: res.status, json };
  };
}

try {
  const owner = await makeUser("Owner");
  const buddy = await makeUser("Buddy");
  const stranger = await makeUser("Stranger");
  const ownerApi = apiAs(owner.token);
  const buddyApi = apiAs(buddy.token);
  const strangerApi = apiAs(stranger.token);
  console.log("  created owner, buddy, stranger\n");

  // Invalid invites
  const selfInvite = await ownerApi("/api/buddy/invite", "POST", { email: owner.email, consent: true, share_next_workout: true, share_support_requests: true, share_confirmation: true });
  ok("cannot invite yourself", selfInvite.status === 400);
  const noConsent = await ownerApi("/api/buddy/invite", "POST", { email: buddy.email, consent: false });
  ok("invite without consent is rejected", noConsent.status === 400);
  const nonMember = await ownerApi("/api/buddy/invite", "POST", { email: "nobody-xyz@example.com", consent: true, share_next_workout: true, share_support_requests: true, share_confirmation: true });
  ok("cannot invite a non-member", nonMember.status === 404);

  // Valid invite
  const invite = await ownerApi("/api/buddy/invite", "POST", { email: buddy.email, relationship: "Friend", consent: true, share_next_workout: true, share_support_requests: true, share_confirmation: true });
  ok("owner invites buddy", invite.status === 201);

  const dupInvite = await ownerApi("/api/buddy/invite", "POST", { email: buddy.email, consent: true, share_next_workout: true, share_support_requests: true, share_confirmation: true });
  ok("duplicate/second buddy invite is rejected (409)", dupInvite.status === 409);

  const ownerView1 = await ownerApi("/api/buddy");
  ok("owner sees pending connection", ownerView1.json.connection?.status === "pending");

  const buddyView1 = await buddyApi("/api/buddy");
  const pendingForBuddy = buddyView1.json.supporting.find((s) => s.status === "pending");
  ok("buddy sees the pending invitation", Boolean(pendingForBuddy));

  // Stranger sees nothing
  const strangerView = await strangerApi("/api/buddy");
  ok("uninvolved member sees no connections", strangerView.json.connection === null && strangerView.json.supporting.length === 0);

  // Stranger cannot accept someone else's invitation
  const strangerAccept = await strangerApi(`/api/buddy/${pendingForBuddy.id}/respond`, "POST", { accept: true });
  ok("a third party cannot accept the invitation", strangerAccept.status === 404);

  // Buddy accepts
  const accept = await buddyApi(`/api/buddy/${pendingForBuddy.id}/respond`, "POST", { accept: true });
  ok("buddy accepts invitation", accept.status === 200);

  // Owner starts a routine so there is a shareable next workout
  await ownerApi("/api/routine/start", "POST", { days_per_week: 3 });

  // Owner requests support
  const reqSupport = await ownerApi("/api/buddy/request-support", "POST", { message: "Cheer me on!" });
  ok("owner requests buddy support", reqSupport.status === 201);

  const buddyView2 = await buddyApi("/api/buddy");
  const active = buddyView2.json.supporting.find((s) => s.status === "active");
  ok("buddy sees active connection + shared next workout", Boolean(active?.sharedNextWorkout?.title));
  ok("privacy matrix: shared workout exposes ONLY title + date", active && Object.keys(active.sharedNextWorkout).sort().join(",") === "date,title");
  ok("buddy sees the support request", (active?.supportRequests?.length || 0) > 0 && active.supportRequests[0].status === "sent");

  // Buddy confirms
  const confirm = await buddyApi(`/api/buddy/support/${active.supportRequests[0].id}/confirm`, "POST");
  ok("buddy confirms support", confirm.status === 200);

  // Stranger cannot confirm
  const strangerConfirm = await strangerApi(`/api/buddy/support/${active.supportRequests[0].id}/confirm`, "POST");
  ok("a third party cannot confirm the support request", strangerConfirm.status === 404);

  // Owner toggles sharing off; buddy can no longer request-support path etc.
  const connId = ownerView1.json.connection.id;
  const shareOff = await ownerApi(`/api/buddy/${connId}/sharing`, "POST", { share_next_workout: false });
  ok("owner can change sharing controls", shareOff.status === 200);
  const buddyView3 = await buddyApi("/api/buddy");
  const active3 = buddyView3.json.supporting.find((s) => s.status === "active");
  ok("turning off sharing hides the next workout from the buddy", active3 && active3.sharedNextWorkout === null);

  // Buddy cannot control the owner's sharing
  const buddyTriesSharing = await buddyApi(`/api/buddy/${connId}/sharing`, "POST", { share_next_workout: true });
  ok("buddy cannot change the owner's sharing", buddyTriesSharing.status === 404);

  // Disconnect
  const disconnect = await ownerApi(`/api/buddy/${connId}/disconnect`, "POST");
  ok("owner disconnects buddy", disconnect.status === 200);
  const buddyView4 = await buddyApi("/api/buddy");
  ok("after disconnect the buddy no longer supports the owner", !buddyView4.json.supporting.some((s) => s.id === connId));

  // --- Account deletion ---
  const doomed = await makeUser("Doomed");
  const del = await apiAs(doomed.token)("/api/me/account", "DELETE");
  ok("DELETE /api/me/account succeeds", del.status === 200 && del.json.ok);
  const lookup = await admin.auth.admin.getUserById(doomed.id);
  ok("deleted account no longer exists in auth", !lookup.data?.user);
  // already gone — drop from cleanup list
  const idx = cleanup.indexOf(doomed.id);
  if (idx >= 0) cleanup.splice(idx, 1);
} catch (err) {
  console.error("\n  Smoke test crashed:", err.message);
  fail++;
} finally {
  for (const id of cleanup) await admin.auth.admin.deleteUser(id).catch(() => {});
  console.log(`\n  cleaned up ${cleanup.length} test users`);
  console.log(`\n  Result: ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
}
