// The 45-Day Routine activation system (PRD §6). Progress is derived, never
// decremented on a miss. Members can start a routine, follow a flexible weekly
// plan, reschedule or skip sessions, and get Comeback / Tired-Day support.
import { Router } from "express";
import { admin } from "../supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { logEvent } from "../lib/events.js";
import { getActiveRoutine, getRoutineProgress, buildSchedule } from "../lib/routine.js";

const router = Router();
const DAY_MS = 24 * 60 * 60 * 1000;

// GET /api/routine — the member's active routine, progress and support prompts.
router.get("/api/routine", requireAuth, async (req, res) => {
  try {
    const progress = await getRoutineProgress(req.user.id);
    res.json(progress);
  } catch (err) {
    console.error("GET /api/routine failed", err);
    res.status(500).json({ error: "We couldn't load your routine. Please try again." });
  }
});

// GET /api/routine/tired-day — a shorter workout for a low-energy day.
router.get("/api/routine/tired-day", requireAuth, async (req, res) => {
  try {
    const { data } = await admin
      .from("workouts")
      .select("id, title, description, workout_type, difficulty, duration_min, equipment, is_short")
      .eq("is_short", true)
      .order("duration_min", { ascending: true })
      .limit(3);
    res.json({ workouts: data || [] });
  } catch (err) {
    console.error("GET /api/routine/tired-day failed", err);
    res.status(500).json({ error: "We couldn't load a shorter workout." });
  }
});

// POST /api/routine/start — activate a 45-day routine.
router.post("/api/routine/start", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    if (await getActiveRoutine(userId)) {
      return res.status(409).json({ error: "You already have an active routine.", reason: "active_exists" });
    }

    const { data: prefs } = await admin
      .from("routine_preferences")
      .select("available_days, workout_duration")
      .eq("user_id", userId)
      .maybeSingle();
    const { data: profile } = await admin
      .from("profiles")
      .select("primary_goal, fitness_experience")
      .eq("id", userId)
      .maybeSingle();

    const availableDays = prefs?.available_days || [];
    const daysPerWeek = clampInt(req.body?.days_per_week, 1, 6, availableDays.length || 3);

    // Choose workouts to cycle through: caller-supplied, else matched to goal.
    let workoutIds = Array.isArray(req.body?.workout_ids) ? req.body.workout_ids.filter(Boolean) : [];
    if (!workoutIds.length) {
      let wq = admin.from("workouts").select("id").order("duration_min", { ascending: true }).limit(8);
      if (profile?.primary_goal) wq = wq.eq("goal", profile.primary_goal);
      const { data: matched } = await wq;
      workoutIds = (matched || []).map((w) => w.id);
      if (!workoutIds.length) {
        const { data: any } = await admin.from("workouts").select("id").limit(8);
        workoutIds = (any || []).map((w) => w.id);
      }
    }

    const startedAt = new Date();
    const endsAt = new Date(startedAt.getTime() + 45 * DAY_MS);
    const { data: routine, error: rErr } = await admin
      .from("routines")
      .insert({
        user_id: userId,
        status: "active",
        target_workouts: 8,
        window_days: 45,
        days_per_week: daysPerWeek,
        started_at: startedAt.toISOString(),
        ends_at: endsAt.toISOString(),
      })
      .select()
      .single();
    if (rErr) throw rErr;

    const rows = buildSchedule({
      routineId: routine.id,
      userId,
      startDate: startedAt,
      windowDays: 45,
      daysPerWeek,
      availableDays,
      workoutIds,
    });
    if (rows.length) {
      const { error: insErr } = await admin.from("scheduled_workouts").insert(rows);
      if (insErr) throw insErr;
    }

    // Weekly targets (routine_weeks), grouped the same way progress groups them.
    const startDay = new Date(startedAt);
    startDay.setHours(0, 0, 0, 0);
    const weekMap = {};
    for (const r of rows) {
      const wk = Math.floor((new Date(r.scheduled_date) - startDay) / (7 * DAY_MS)) + 1;
      weekMap[wk] = (weekMap[wk] || 0) + 1;
    }
    const weekRows = Object.entries(weekMap).map(([wk, count]) => ({
      routine_id: routine.id,
      week_number: Number(wk),
      starts_on: new Date(startDay.getTime() + (Number(wk) - 1) * 7 * DAY_MS).toISOString().slice(0, 10),
      planned_count: count,
    }));
    if (weekRows.length) await admin.from("routine_weeks").insert(weekRows);

    await logEvent(userId, "routine_started", { routine: routine.id, days_per_week: daysPerWeek });
    const progress = await getRoutineProgress(userId);
    res.status(201).json(progress);
  } catch (err) {
    console.error("POST /api/routine/start failed", err);
    res.status(500).json({ error: "We couldn't start your routine. Please try again." });
  }
});

// POST /api/routine/schedule — add a planned workout to the active routine.
router.post("/api/routine/schedule", requireAuth, async (req, res) => {
  try {
    const routine = await getActiveRoutine(req.user.id);
    if (!routine) return res.status(409).json({ error: "Start a routine first." });
    const { workout_id, date } = req.body || {};
    if (!date) return res.status(400).json({ error: "Please choose a date." });
    const { error } = await admin.from("scheduled_workouts").insert({
      routine_id: routine.id,
      user_id: req.user.id,
      workout_id: workout_id || null,
      scheduled_date: date,
      status: "planned",
    });
    if (error) throw error;
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error("POST /api/routine/schedule failed", err);
    res.status(500).json({ error: "We couldn't schedule that workout." });
  }
});

// POST /api/routine/schedule/:id/reschedule — move a planned session.
router.post("/api/routine/schedule/:id/reschedule", requireAuth, async (req, res) => {
  try {
    const { date } = req.body || {};
    if (!date) return res.status(400).json({ error: "Please choose a new date." });
    const { data, error } = await admin
      .from("scheduled_workouts")
      .update({ scheduled_date: date, status: "planned" })
      .eq("id", req.params.id)
      .eq("user_id", req.user.id)
      .in("status", ["planned", "skipped", "rescheduled"])
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "We couldn't find that scheduled workout." });
    await logEvent(req.user.id, "workout_rescheduled", { scheduled: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    console.error("reschedule failed", err);
    res.status(500).json({ error: "We couldn't reschedule that workout." });
  }
});

// POST /api/routine/schedule/:id/skip — mark a session skipped (no shame, no reset).
router.post("/api/routine/schedule/:id/skip", requireAuth, async (req, res) => {
  try {
    const { data, error } = await admin
      .from("scheduled_workouts")
      .update({ status: "skipped" })
      .eq("id", req.params.id)
      .eq("user_id", req.user.id)
      .eq("status", "planned")
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "We couldn't find that scheduled workout." });
    res.json({ ok: true });
  } catch (err) {
    console.error("skip failed", err);
    res.status(500).json({ error: "We couldn't update that workout." });
  }
});

function clampInt(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

export default router;
