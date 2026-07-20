// Automated cross-user security suite (PRD security requirements).
//
// Proves that one authenticated member (B) can never access or modify another
// member's (A) data — at TWO layers:
//   1. Database RLS: using B's own Supabase JWT to query tables directly.
//   2. API: using B's bearer token against the real Express app (in-process).
//
// Also checks that unauthenticated requests are rejected. Creates throwaway
// users and cleans them up. Requires .env (SUPABASE_URL, SUPABASE_SECRET_KEY,
// SUPABASE_PUBLISHABLE_KEY). Run: npm run test:security
import "dotenv/config";
import { before, after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import app from "../server/app.js";

const url = process.env.SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const pubKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const admin = createClient(url, secret, { auth: { persistSession: false } });

const ctx = { cleanup: [], base: "", A: null, B: null, ids: {} };

function scoped(token) {
  // A Supabase client acting AS the given user, so RLS policies apply to it.
  return createClient(url, pubKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

async function makeUser(name) {
  const email = `sec-${name}+${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`;
  const password = "sec-password-123";
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name } });
  if (created.error) throw created.error;
  ctx.cleanup.push(created.data.user.id);
  await new Promise((r) => setTimeout(r, 250));
  const pub = createClient(url, pubKey, { auth: { persistSession: false } });
  const s = await pub.auth.signInWithPassword({ email, password });
  if (s.error) throw s.error;
  return { id: created.data.user.id, email, token: s.data.session.access_token, client: scoped(s.data.session.access_token) };
}

function apiFetch(path, { method = "GET", token, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${ctx.base}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }).then(async (r) => ({
    status: r.status,
    json: await r.json().catch(() => null),
  }));
}

before(async () => {
  // Start the real app in-process on an ephemeral port.
  await new Promise((resolve) => {
    ctx.server = app.listen(0, () => {
      ctx.base = `http://127.0.0.1:${ctx.server.address().port}`;
      resolve();
    });
  });

  ctx.A = await makeUser("Alice");
  ctx.B = await makeUser("Bob");

  // Reference ids for seeding A's owned data.
  const [{ data: plan }, { data: gym }, { data: session }, { data: workout }] = await Promise.all([
    admin.from("membership_plans").select("id").limit(1).single(),
    admin.from("gyms").select("id").limit(1).single(),
    admin.from("class_sessions").select("id").gt("starts_at", new Date().toISOString()).limit(1).single(),
    admin.from("workouts").select("id").limit(1).single(),
  ]);

  // Seed A-owned rows directly (admin bypasses RLS) so B has something to try to reach.
  const { data: membership } = await admin.from("memberships").insert({ user_id: ctx.A.id, plan_id: plan.id, home_gym_id: gym.id, status: "active" }).select("id").single();
  const { data: booking } = await admin.from("bookings").insert({ user_id: ctx.A.id, class_session_id: session.id, status: "booked" }).select("id").single();
  const { data: visit } = await admin.from("visits").insert({ user_id: ctx.A.id, gym_id: gym.id, status: "completed" }).select("id").single();
  const { data: ai } = await admin.from("ai_messages").insert({ user_id: ctx.A.id, role: "user", content: "private message" }).select("id").single();
  const { data: buddy } = await admin.from("buddy_connections").insert({ owner_id: ctx.A.id, buddy_email: "someone@example.com", status: "pending" }).select("id").single();

  // Seed A-owned rows via the real API (as A) to exercise the write paths too.
  await apiFetch("/api/routine/start", { method: "POST", token: ctx.A.token, body: { days_per_week: 3 } });
  const routine = await apiFetch("/api/routine", { token: ctx.A.token });
  const scheduled = (routine.json.weeklyPlan || []).flatMap((w) => w.items).find((i) => i.status === "planned");
  const started = await apiFetch(`/api/workouts/${workout.id}/start`, { method: "POST", token: ctx.A.token });
  await apiFetch("/api/nutrition/profile", { method: "POST", token: ctx.A.token, body: { goal: "general", dietary_preference: "no_preference" } });
  const meal = await apiFetch("/api/nutrition/log", { method: "POST", token: ctx.A.token, body: { meal_type: "snack", name: "A private snack", calories: 100 } });

  ctx.ids = {
    membership: membership.id,
    booking: booking.id,
    visit: visit.id,
    ai: ai.id,
    buddy: buddy.id,
    routine: routine.json.routine?.id,
    scheduled: scheduled?.id,
    session: started.json.session?.id,
    mealEntry: meal.json.entry?.id,
  };
});

after(async () => {
  if (ctx.server) await new Promise((r) => ctx.server.close(r));
  for (const id of ctx.cleanup) await admin.auth.admin.deleteUser(id).catch(() => {});
});

describe("Database RLS — B cannot read A's rows", () => {
  const cases = [
    ["profiles", "id"],
    ["memberships", "user_id"],
    ["bookings", "user_id"],
    ["visits", "user_id"],
    ["workout_sessions", "user_id"],
    ["scheduled_workouts", "user_id"],
    ["routines", "user_id"],
    ["nutrition_profiles", "user_id"],
    ["meal_entries", "user_id"],
    ["ai_messages", "user_id"],
    ["buddy_connections", "owner_id"],
  ];
  for (const [table, col] of cases) {
    it(`${table}: B's client sees none of A's rows`, async () => {
      const { data, error } = await ctx.B.client.from(table).select("*").eq(col, ctx.A.id);
      assert.ok(!error, error?.message);
      assert.equal(data.length, 0, `B could read ${data.length} of A's ${table} rows`);
    });
  }

  it("A's own client CAN read A's profile (sanity check)", async () => {
    const { data } = await ctx.A.client.from("profiles").select("id").eq("id", ctx.A.id);
    assert.equal(data.length, 1);
  });
});

describe("Database RLS — B cannot write A's rows", () => {
  it("B cannot insert a meal_entry impersonating A", async () => {
    const { error } = await ctx.B.client
      .from("meal_entries")
      .insert({ user_id: ctx.A.id, entry_date: new Date().toISOString().slice(0, 10), meal_type: "snack", name: "injected" });
    assert.ok(error, "RLS should reject inserting rows owned by another user");
  });

  it("B cannot update A's profile", async () => {
    const { data } = await ctx.B.client.from("profiles").update({ name: "hacked" }).eq("id", ctx.A.id).select();
    assert.equal(data?.length ?? 0, 0);
    const { data: after } = await admin.from("profiles").select("name").eq("id", ctx.A.id).single();
    assert.notEqual(after.name, "hacked");
  });

  it("B cannot delete A's meal_entry", async () => {
    await ctx.B.client.from("meal_entries").delete().eq("id", ctx.ids.mealEntry);
    const { data } = await admin.from("meal_entries").select("id").eq("id", ctx.ids.mealEntry).maybeSingle();
    assert.ok(data, "A's meal entry must still exist");
  });
});

describe("API — B cannot act on A's resources", () => {
  it("GET /api/sessions/:id (A's) → 404 for B", async () => {
    const r = await apiFetch(`/api/sessions/${ctx.ids.session}`, { token: ctx.B.token });
    assert.equal(r.status, 404);
  });

  it("POST /api/sessions/:id/complete (A's) → not allowed for B", async () => {
    const r = await apiFetch(`/api/sessions/${ctx.ids.session}/complete`, { method: "POST", token: ctx.B.token });
    assert.ok(r.status === 404 || r.status === 409, `got ${r.status}`);
    const { data } = await admin.from("workout_sessions").select("status").eq("id", ctx.ids.session).single();
    assert.equal(data.status, "in_progress", "A's session must be untouched");
  });

  it("POST /api/bookings/:id/cancel (A's) → rejected for B", async () => {
    const r = await apiFetch(`/api/bookings/${ctx.ids.booking}/cancel`, { method: "POST", token: ctx.B.token });
    assert.equal(r.status, 409);
    const { data } = await admin.from("bookings").select("status").eq("id", ctx.ids.booking).single();
    assert.equal(data.status, "booked", "A's booking must remain booked");
  });

  it("POST /api/routine/schedule/:id/skip (A's) → 404 for B", async () => {
    const r = await apiFetch(`/api/routine/schedule/${ctx.ids.scheduled}/skip`, { method: "POST", token: ctx.B.token });
    assert.equal(r.status, 404);
  });

  it("DELETE /api/nutrition/log/:id (A's) → does not delete A's entry", async () => {
    await apiFetch(`/api/nutrition/log/${ctx.ids.mealEntry}`, { method: "DELETE", token: ctx.B.token });
    const { data } = await admin.from("meal_entries").select("id").eq("id", ctx.ids.mealEntry).maybeSingle();
    assert.ok(data, "A's meal entry must still exist after B's delete attempt");
  });

  it("POST /api/buddy/:id/disconnect (A's) → 404 for B", async () => {
    const r = await apiFetch(`/api/buddy/${ctx.ids.buddy}/disconnect`, { method: "POST", token: ctx.B.token });
    assert.equal(r.status, 404);
  });

  it("GET /api/routine returns B's own (inactive) routine, not A's active one", async () => {
    const r = await apiFetch("/api/routine", { token: ctx.B.token });
    assert.equal(r.json.active, false);
  });

  it("GET /api/me returns B's own profile, never A's", async () => {
    const r = await apiFetch("/api/me", { token: ctx.B.token });
    assert.equal(r.json.profile.id, ctx.B.id);
    assert.notEqual(r.json.profile.id, ctx.A.id);
  });
});

describe("API — unauthenticated access is rejected", () => {
  for (const path of ["/api/me", "/api/workouts", "/api/routine", "/api/nutrition", "/api/buddy", "/api/bookings"]) {
    it(`GET ${path} without a token → 401`, async () => {
      const r = await apiFetch(path);
      assert.equal(r.status, 401);
    });
  }

  it("public health check stays open", async () => {
    const r = await apiFetch("/api/health");
    assert.equal(r.status, 200);
  });
});
