// Temporary end-to-end smoke test for the Workouts + 45-Day Routine features.
// Creates a throwaway user, signs in for a real token, exercises the new API
// routes against a locally running server, then deletes the user. Reads creds
// from .env. Run: node scripts/smoke-workouts.js
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.SMOKE_BASE || "http://localhost:3001";
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const pub = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });

const email = `smoke+${Date.now()}@example.com`;
const password = "smoke-password-123";
let userId, token;
let pass = 0, fail = 0;
function ok(name, cond, extra = "") { (cond ? pass++ : fail++); console.log(`  ${cond ? "✓" : "✗"} ${name}${extra ? " — " + extra : ""}`); }

async function api(path, method = "GET", body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, json };
}

try {
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name: "Smoke Tester" } });
  if (created.error) throw created.error;
  userId = created.data.user.id;
  await new Promise((r) => setTimeout(r, 400));

  const signIn = await pub.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  token = signIn.data.session.access_token;
  console.log("  signed in as", email, "\n");

  // Give the member some preferences so routine generation has days to use.
  await admin.from("routine_preferences").upsert({ user_id: userId, available_days: ["Monday", "Wednesday", "Friday"], workout_duration: 30 });

  // --- Workouts library ---
  const lib = await api("/api/workouts");
  ok("GET /api/workouts returns library", lib.status === 200 && Array.isArray(lib.json?.workouts) && lib.json.workouts.length > 0, `${lib.json?.workouts?.length || 0} workouts`);
  const workout = lib.json.workouts[0];

  const filtered = await api("/api/workouts?short=true");
  ok("GET /api/workouts?short filters", filtered.status === 200 && filtered.json.workouts.every((w) => w.is_short));

  const detail = await api(`/api/workouts/${workout.id}`);
  ok("GET /api/workouts/:id returns exercises", detail.status === 200 && detail.json.exercises.length > 0, `${detail.json?.exercises?.length} exercises`);

  // --- Start a guided session ---
  const start = await api(`/api/workouts/${workout.id}/start`, "POST");
  ok("POST start creates in_progress session", start.status === 201 && start.json.session.status === "in_progress");
  const session = start.json.session;

  const resume = await api("/api/sessions/active");
  ok("GET /api/sessions/active returns the session (resume)", resume.status === 200 && resume.json.session?.id === session.id);

  // --- Toggle an exercise + persistence ---
  const ex = session.exercises[0];
  const toggle = await api(`/api/sessions/${session.id}/exercises/${ex.id}/toggle`, "POST", { completed: true });
  ok("POST toggle exercise", toggle.status === 200);
  const reload = await api(`/api/sessions/${session.id}`);
  ok("toggle persisted", reload.json.session.exercises.find((e) => e.id === ex.id)?.completed === true);

  // --- Complete ---
  const complete = await api(`/api/sessions/${session.id}/complete`, "POST", { total_duration_sec: 600 });
  ok("POST complete session", complete.status === 200 && complete.json.ok);

  const history = await api("/api/sessions/history");
  ok("GET history shows completed workout", history.status === 200 && history.json.sessions.some((s) => s.id === session.id && s.status === "completed"));

  // --- 45-Day Routine ---
  const noRoutine = await api("/api/routine");
  ok("GET /api/routine before start = inactive", noRoutine.status === 200 && noRoutine.json.active === false);

  const startRoutine = await api("/api/routine/start", "POST", { days_per_week: 3 });
  ok("POST /api/routine/start activates", startRoutine.status === 201 && startRoutine.json.active === true, `target ${startRoutine.json.target}`);
  ok("routine generated a weekly plan", (startRoutine.json.weeklyPlan?.length || 0) > 0, `${startRoutine.json.weeklyPlan?.length} weeks`);

  const dupRoutine = await api("/api/routine/start", "POST", { days_per_week: 3 });
  ok("second routine start is rejected (409)", dupRoutine.status === 409);

  const routine = await api("/api/routine");
  const firstPlanned = routine.json.weeklyPlan?.flatMap((w) => w.items).find((i) => i.status === "planned");
  ok("routine has planned scheduled workouts", Boolean(firstPlanned));

  if (firstPlanned) {
    const resched = await api(`/api/routine/schedule/${firstPlanned.id}/reschedule`, "POST", { date: "2030-01-01" });
    ok("reschedule a planned workout", resched.status === 200 && resched.json.ok);
    const skipTarget = routine.json.weeklyPlan.flatMap((w) => w.items).find((i) => i.status === "planned" && i.id !== firstPlanned.id);
    if (skipTarget) {
      const skip = await api(`/api/routine/schedule/${skipTarget.id}/skip`, "POST");
      ok("skip a planned workout", skip.status === 200 && skip.json.ok);
    }
  }

  const tired = await api("/api/routine/tired-day");
  ok("GET /api/routine/tired-day returns short workouts", tired.status === 200 && tired.json.workouts.every((w) => w.is_short));

  // --- Nutrition ---
  const beforeProfile = await api("/api/nutrition");
  ok("GET /api/nutrition before setup has no profile", beforeProfile.status === 200 && beforeProfile.json.profile === null);

  const setProfile = await api("/api/nutrition/profile", "POST", { goal: "gain_muscle", dietary_preference: "vegetarian" });
  ok("POST /api/nutrition/profile derives macro targets", setProfile.status === 200 && setProfile.json.profile.protein_target_g > 0);

  const nut = await api("/api/nutrition");
  ok("nutrition returns targets + a suggested plan", nut.status === 200 && nut.json.targets && nut.json.plan.length > 0);
  ok("vegetarian diet excludes non_veg meals", nut.json.plan.every((m) => m.diet !== "non_veg"));

  const vegMeals = await api("/api/nutrition/meals?type=lunch");
  ok("meal catalogue respects diet + type", vegMeals.status === 200 && vegMeals.json.meals.every((m) => m.meal_type === "lunch" && m.diet !== "non_veg"));

  const logCatalogue = await api("/api/nutrition/log", "POST", { meal_id: vegMeals.json.meals[0].id, meal_type: "lunch" });
  ok("POST /api/nutrition/log logs a catalogue meal", logCatalogue.status === 201 && logCatalogue.json.entry.calories > 0);

  const logManual = await api("/api/nutrition/log", "POST", { meal_type: "snack", name: "Test snack", calories: 150, protein_g: 10 });
  ok("POST /api/nutrition/log logs a manual meal", logManual.status === 201);

  const afterLog = await api("/api/nutrition");
  ok("day totals reflect logged meals", afterLog.json.totals.calories > 0 && afterLog.json.remaining.calories === afterLog.json.targets.calories - afterLog.json.totals.calories);

  const delMeal = await api(`/api/nutrition/log/${logManual.json.entry.id}`, "DELETE");
  ok("DELETE /api/nutrition/log/:id removes an entry", delMeal.status === 200);

  const nutHistory = await api("/api/nutrition/history?days=7");
  ok("GET /api/nutrition/history returns daily totals", nutHistory.status === 200 && Array.isArray(nutHistory.json.history));

  // --- No token = rejected ---
  const savedToken = token; token = "invalid";
  const unauth = await api("/api/workouts");
  ok("requests without a valid token are rejected", unauth.status === 401);
  token = savedToken;
} catch (err) {
  console.error("\n  Smoke test crashed:", err.message);
  fail++;
} finally {
  if (userId) { await admin.auth.admin.deleteUser(userId); console.log("\n  cleaned up test user"); }
  console.log(`\n  Result: ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
}
