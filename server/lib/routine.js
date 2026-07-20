// Shared 45-Day Routine logic (PRD §6). Progress is DERIVED from real data
// (completed sessions + scheduled workouts) rather than a mutable counter, so
// it can never drift. Missing a workout never reduces completed progress —
// it only changes the encouragement we show. Used by the routine routes and
// the AI assistant tools so both speak from the same source of truth.
import { admin } from "../supabase.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export async function getActiveRoutine(userId) {
  const { data, error } = await admin
    .from("routines")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Full progress snapshot for the signed-in member's active routine.
export async function getRoutineProgress(userId) {
  const routine = await getActiveRoutine(userId);
  if (!routine) return { active: false };

  const started = new Date(routine.started_at);
  const ends = new Date(routine.ends_at);
  const now = new Date();

  const [{ data: completedSessions }, { data: scheduled }, { data: lastSession }] = await Promise.all([
    admin
      .from("workout_sessions")
      .select("id, completed_at")
      .eq("user_id", userId)
      .eq("status", "completed")
      .gte("completed_at", started.toISOString())
      .lte("completed_at", ends.toISOString()),
    admin
      .from("scheduled_workouts")
      .select("id, scheduled_date, status, workout_id, session_id, workout:workouts(id, title, workout_type, duration_min, difficulty)")
      .eq("routine_id", routine.id)
      .order("scheduled_date", { ascending: true }),
    admin
      .from("workout_sessions")
      .select("completed_at")
      .eq("user_id", userId)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const completedCount = (completedSessions || []).length;
  const daysElapsed = Math.max(0, Math.floor((now - started) / DAY_MS));
  const daysLeft = Math.max(0, Math.ceil((ends - now) / DAY_MS));
  const weekNumber = Math.min(Math.floor(daysElapsed / 7) + 1, Math.ceil(routine.window_days / 7));

  // Gentle expectation: pro-rated toward the 4-week target, never punitive.
  const focusDays = 28;
  const expectedByNow = Math.round(routine.target_workouts * (Math.min(daysElapsed, focusDays) / focusDays));
  const onTrack = completedCount >= expectedByNow;

  const today = startOfToday();
  const sched = scheduled || [];
  const planned = sched.filter((s) => s.status === "planned").length;
  const skipped = sched.filter((s) => s.status === "skipped").length;
  const missed = sched.filter(
    (s) => s.status === "planned" && new Date(s.scheduled_date) < today
  ).length;
  const next = sched.find(
    (s) => s.status === "planned" && new Date(s.scheduled_date) >= today
  ) || null;

  const lastCompletedAt = lastSession?.completed_at || null;
  const daysSinceLast = lastCompletedAt
    ? Math.floor((now - new Date(lastCompletedAt)) / DAY_MS)
    : null;

  // Comeback Mode: prompted by a real gap, not by shame.
  const needsComeback = missed > 0 || (daysSinceLast !== null && daysSinceLast >= 7) || (daysSinceLast === null && daysElapsed >= 5);

  // Weekly plan grouped by routine week.
  const weeks = {};
  for (const s of sched) {
    const wk = Math.floor((new Date(s.scheduled_date) - started) / (7 * DAY_MS)) + 1;
    if (!weeks[wk]) weeks[wk] = { week: wk, planned: 0, completed: 0, skipped: 0, items: [] };
    weeks[wk].items.push(s);
    if (s.status === "completed") weeks[wk].completed += 1;
    else if (s.status === "skipped") weeks[wk].skipped += 1;
    else weeks[wk].planned += 1;
  }

  return {
    active: true,
    routine,
    completedCount,
    target: routine.target_workouts,
    remainingToTarget: Math.max(0, routine.target_workouts - completedCount),
    targetMet: completedCount >= routine.target_workouts,
    daysElapsed,
    daysLeft,
    weekNumber,
    onTrack,
    expectedByNow,
    plannedRemaining: planned,
    skipped,
    missed,
    next,
    lastCompletedAt,
    daysSinceLast,
    needsComeback,
    weeklyPlan: Object.values(weeks).sort((a, b) => a.week - b.week),
  };
}

// Build the schedule for a new routine from the member's preferred weekdays,
// cycling through the chosen workouts. Returns rows ready for bulk insert.
export function buildSchedule({ routineId, userId, startDate, windowDays, daysPerWeek, availableDays, workoutIds }) {
  const preferredIdx = (availableDays || [])
    .map((d) => WEEKDAYS.indexOf(d))
    .filter((i) => i >= 0);
  // Fall back to a sensible Mon/Wed/Fri-style spread if no preference given.
  const targetPerWeek = Math.max(1, Math.min(daysPerWeek || preferredIdx.length || 3, 6));
  const dayset = preferredIdx.length ? preferredIdx : defaultDays(targetPerWeek);

  const rows = [];
  const weeks = Math.ceil(windowDays / 7);
  let wIdx = 0;
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  for (let week = 0; week < weeks; week += 1) {
    const weekStart = new Date(start.getTime() + week * 7 * DAY_MS);
    // Anchor to the Sunday of that week so weekdays land correctly.
    const anchor = new Date(weekStart.getTime() - weekStart.getDay() * DAY_MS);
    const chosen = dayset.slice(0, targetPerWeek).sort((a, b) => a - b);
    for (const dow of chosen) {
      const date = new Date(anchor.getTime() + dow * DAY_MS);
      if (date < start) continue;
      if ((date - start) / DAY_MS >= windowDays) continue;
      rows.push({
        routine_id: routineId,
        user_id: userId,
        workout_id: workoutIds.length ? workoutIds[wIdx % workoutIds.length] : null,
        scheduled_date: date.toISOString().slice(0, 10),
        status: "planned",
      });
      wIdx += 1;
    }
  }
  return rows;
}

function defaultDays(n) {
  const spreads = { 1: [3], 2: [2, 4], 3: [1, 3, 5], 4: [1, 2, 4, 6], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6] };
  return spreads[n] || [1, 3, 5];
}

export { WEEKDAYS };
