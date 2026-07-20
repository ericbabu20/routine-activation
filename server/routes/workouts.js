// Workout discovery + guided session player (PRD §5). Sessions persist
// per-exercise progress so an interrupted workout is recoverable after a
// refresh. Completing a session updates any linked routine scheduled workout.
import { Router } from "express";
import { admin } from "../supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { logEvent } from "../lib/events.js";

const router = Router();

// GET /api/workouts — filterable library.
router.get("/api/workouts", requireAuth, async (req, res) => {
  try {
    const { goal, type, difficulty, equipment, duration_max, short } = req.query;
    let q = admin
      .from("workouts")
      .select("id, title, description, goal, workout_type, difficulty, duration_min, equipment, is_short")
      .order("duration_min", { ascending: true })
      .limit(100);

    if (goal) q = q.eq("goal", goal);
    if (type) q = q.eq("workout_type", type);
    if (difficulty) q = q.eq("difficulty", difficulty);
    if (short === "true") q = q.eq("is_short", true);
    if (duration_max) q = q.lte("duration_min", Number(duration_max));
    if (equipment) q = q.contains("equipment", [String(equipment)]);

    const { data, error } = await q;
    if (error) throw error;
    res.json({ workouts: data || [] });
  } catch (err) {
    console.error("GET /api/workouts failed", err);
    res.status(500).json({ error: "We couldn't load workouts. Please try again." });
  }
});

// GET /api/sessions/active — the member's in-progress session (for resume).
router.get("/api/sessions/active", requireAuth, async (req, res) => {
  try {
    const session = await loadActiveSession(req.user.id);
    res.json({ session });
  } catch (err) {
    console.error("GET /api/sessions/active failed", err);
    res.status(500).json({ error: "We couldn't check your active workout." });
  }
});

// GET /api/sessions/history — completed workouts.
router.get("/api/sessions/history", requireAuth, async (req, res) => {
  try {
    const { data, error } = await admin
      .from("workout_sessions")
      .select("id, title, status, started_at, completed_at, total_duration_sec, workout:workouts(workout_type, difficulty)")
      .eq("user_id", req.user.id)
      .in("status", ["completed", "abandoned"])
      .order("started_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    res.json({ sessions: data || [] });
  } catch (err) {
    console.error("GET /api/sessions/history failed", err);
    res.status(500).json({ error: "We couldn't load your workout history." });
  }
});

// GET /api/workouts/:id — detail + ordered exercises.
router.get("/api/workouts/:id", requireAuth, async (req, res) => {
  try {
    const { data: workout, error } = await admin
      .from("workouts")
      .select("id, title, description, goal, workout_type, difficulty, duration_min, equipment, is_short")
      .eq("id", req.params.id)
      .maybeSingle();
    if (error) throw error;
    if (!workout) return res.status(404).json({ error: "We couldn't find that workout." });

    const { data: exercises } = await admin
      .from("workout_exercises")
      .select("id, position, name, instructions, sets, reps, duration_sec, rest_sec")
      .eq("workout_id", workout.id)
      .order("position", { ascending: true });

    res.json({ workout, exercises: exercises || [] });
  } catch (err) {
    console.error("GET /api/workouts/:id failed", err);
    res.status(500).json({ error: "We couldn't load that workout." });
  }
});

// GET /api/sessions/:id — a single session + its exercises (the player).
router.get("/api/sessions/:id", requireAuth, async (req, res) => {
  try {
    const session = await loadSession(req.user.id, req.params.id);
    if (!session) return res.status(404).json({ error: "We couldn't find that workout session." });
    res.json({ session });
  } catch (err) {
    console.error("GET /api/sessions/:id failed", err);
    res.status(500).json({ error: "We couldn't load that workout session." });
  }
});

// POST /api/workouts/:id/start — begin a guided session (or resume the active one).
router.post("/api/workouts/:id/start", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const scheduledId = req.body?.scheduled_id || null;

    const active = await loadActiveSession(userId);
    if (active) {
      if (active.workout_id === req.params.id) return res.json({ session: active, resumed: true });
      return res.status(409).json({
        error: "You already have a workout in progress. Finish or end it first.",
        reason: "active_exists",
        activeSessionId: active.id,
      });
    }

    const { data: workout, error: wErr } = await admin
      .from("workouts")
      .select("id, title")
      .eq("id", req.params.id)
      .maybeSingle();
    if (wErr) throw wErr;
    if (!workout) return res.status(404).json({ error: "We couldn't find that workout." });

    const { data: session, error: sErr } = await admin
      .from("workout_sessions")
      .insert({ user_id: userId, workout_id: workout.id, title: workout.title, status: "in_progress" })
      .select()
      .single();
    if (sErr) throw sErr;

    const { data: exercises } = await admin
      .from("workout_exercises")
      .select("position, name, instructions, sets, reps, duration_sec, rest_sec")
      .eq("workout_id", workout.id)
      .order("position", { ascending: true });

    if (exercises?.length) {
      await admin.from("workout_session_exercises").insert(
        exercises.map((e) => ({
          session_id: session.id,
          position: e.position,
          name: e.name,
          instructions: e.instructions,
          target_sets: e.sets,
          target_reps: e.reps,
          target_duration_sec: e.duration_sec,
          rest_sec: e.rest_sec,
        }))
      );
    }

    // Link this session to a routine scheduled workout, if the member came from one.
    if (scheduledId) {
      await admin
        .from("scheduled_workouts")
        .update({ session_id: session.id })
        .eq("id", scheduledId)
        .eq("user_id", userId);
    }

    await logEvent(userId, "workout_started", { workout: workout.id });
    const full = await loadSession(userId, session.id);
    res.status(201).json({ session: full });
  } catch (err) {
    console.error("POST /api/workouts/:id/start failed", err);
    res.status(500).json({ error: "We couldn't start that workout. Please try again." });
  }
});

// POST /api/sessions/:id/exercises/:exId/toggle — persist per-exercise progress.
router.post("/api/sessions/:id/exercises/:exId/toggle", requireAuth, async (req, res) => {
  try {
    const owned = await ownsSession(req.user.id, req.params.id);
    if (!owned) return res.status(404).json({ error: "We couldn't find that workout session." });
    const completed = Boolean(req.body?.completed);
    const { error } = await admin
      .from("workout_session_exercises")
      .update({ completed, completed_at: completed ? new Date().toISOString() : null })
      .eq("id", req.params.exId)
      .eq("session_id", req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error("toggle exercise failed", err);
    res.status(500).json({ error: "We couldn't save your progress. Please try again." });
  }
});

// POST /api/sessions/:id/complete — finish and save the workout.
router.post("/api/sessions/:id/complete", requireAuth, async (req, res) => {
  try {
    const session = await loadSession(req.user.id, req.params.id);
    if (!session) return res.status(404).json({ error: "We couldn't find that workout session." });
    if (session.status !== "in_progress") return res.status(409).json({ error: "This workout is already finished." });

    const totalSec = Number.isFinite(req.body?.total_duration_sec) ? Math.max(0, Math.floor(req.body.total_duration_sec)) : null;
    const { error } = await admin
      .from("workout_sessions")
      .update({ status: "completed", completed_at: new Date().toISOString(), total_duration_sec: totalSec })
      .eq("id", session.id)
      .eq("user_id", req.user.id);
    if (error) throw error;

    // Mark any linked routine scheduled workout complete.
    await admin
      .from("scheduled_workouts")
      .update({ status: "completed" })
      .eq("session_id", session.id)
      .eq("user_id", req.user.id);

    await logEvent(req.user.id, "workout_completed", { session: session.id });
    res.json({ ok: true });
  } catch (err) {
    console.error("complete session failed", err);
    res.status(500).json({ error: "We couldn't save your workout. Please try again." });
  }
});

// POST /api/sessions/:id/abandon — discard an in-progress session.
router.post("/api/sessions/:id/abandon", requireAuth, async (req, res) => {
  try {
    const { error } = await admin
      .from("workout_sessions")
      .update({ status: "abandoned" })
      .eq("id", req.params.id)
      .eq("user_id", req.user.id)
      .eq("status", "in_progress");
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error("abandon session failed", err);
    res.status(500).json({ error: "We couldn't update that workout." });
  }
});

// ---- helpers ---------------------------------------------------------------
async function ownsSession(userId, sessionId) {
  const { data } = await admin
    .from("workout_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data);
}

async function loadSession(userId, sessionId) {
  const { data: session } = await admin
    .from("workout_sessions")
    .select("id, workout_id, title, status, started_at, completed_at, total_duration_sec")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!session) return null;
  const { data: exercises } = await admin
    .from("workout_session_exercises")
    .select("id, position, name, instructions, target_sets, target_reps, target_duration_sec, rest_sec, completed")
    .eq("session_id", session.id)
    .order("position", { ascending: true });
  return { ...session, exercises: exercises || [] };
}

async function loadActiveSession(userId) {
  const { data: session } = await admin
    .from("workout_sessions")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "in_progress")
    .maybeSingle();
  if (!session) return null;
  return loadSession(userId, session.id);
}

export default router;
