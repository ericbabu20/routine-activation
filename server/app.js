// The Express application (routes + middleware), exported so it can run both as
// a long-lived server (server/index.js, local dev + `npm start`) and as a Vercel
// serverless function (api/index.js).
//
// Member identity is ALWAYS resolved from the verified Supabase session on the
// server (requireAuth → req.user.id). Client-supplied ids are never trusted.
import "dotenv/config";
import express from "express";
import cors from "cors";
import { admin } from "./supabase.js";
import { requireAuth } from "./middleware/auth.js";
import { logEvent } from "./lib/events.js";
import referenceRoutes from "./routes/reference.js";
import membershipRoutes from "./routes/membership.js";
import onboardingRoutes from "./routes/onboarding.js";
import passRoutes from "./routes/pass.js";
import accessRoutes from "./routes/access.js";
import activityRoutes from "./routes/activity.js";
import classRoutes from "./routes/classes.js";
import workoutRoutes from "./routes/workouts.js";
import routineRoutes from "./routes/routines.js";
import nutritionRoutes from "./routes/nutrition.js";
import buddyRoutes from "./routes/buddy.js";
import aiRoutes from "./routes/ai.js";

const app = express();
app.use(cors());
// Capture the raw body so the access-webhook route can verify its HMAC signature.
app.use(express.json({ limit: "1mb", verify: (req, _res, buf) => { req.rawBody = buf; } }));

// ---- Health (public) --------------------------------------------------------
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "cultfit-routine-activation",
    supabase: Boolean(admin),
    time: new Date().toISOString(),
  });
});

// ---- Current member (protected) --------------------------------------------
// Returns the signed-in member's profile + onboarding status. Used by the
// client to decide between onboarding and the main app.
app.get("/api/me", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id; // authoritative identity
    const { data: profile, error } = await admin
      .from("profiles")
      .select(
        "id, name, email, phone, date_of_birth, fitness_experience, primary_goal, home_gym_id, onboarding_completed, created_at"
      )
      .eq("id", userId)
      .maybeSingle();

    if (error) throw error;

    // Fallback: if the sign-up trigger hasn't populated a row yet, create one.
    if (!profile) {
      const { data: created, error: insErr } = await admin
        .from("profiles")
        .insert({ id: userId, email: req.user.email })
        .select()
        .single();
      if (insErr) throw insErr;
      return res.json({ profile: created });
    }

    res.json({ profile });
  } catch (err) {
    console.error("GET /api/me failed", err);
    res.status(500).json({ error: "We couldn't load your account. Please try again." });
  }
});

// ---- Update basic profile (protected) --------------------------------------
app.patch("/api/me", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const allowed = ["name", "phone", "date_of_birth", "fitness_experience", "primary_goal"];
    const patch = {};
    for (const k of allowed) if (k in (req.body || {})) patch[k] = req.body[k];

    const { data, error } = await admin
      .from("profiles")
      .update(patch)
      .eq("id", userId) // ownership filter
      .select()
      .single();
    if (error) throw error;
    res.json({ profile: data });
  } catch (err) {
    console.error("PATCH /api/me failed", err);
    res.status(500).json({ error: "We couldn't save your changes. Please try again." });
  }
});

// ---- Delete account (protected) --------------------------------------------
// Permanently removes the member. All owned rows cascade via ON DELETE CASCADE
// foreign keys to auth.users (profiles, memberships, sessions, routine,
// nutrition, buddy connections, etc.).
app.delete("/api/me/account", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    await logEvent(userId, "account_deletion_requested", null);
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/me/account failed", err);
    res.status(500).json({ error: "We couldn't delete your account. Please try again." });
  }
});

// ---- Analytics event (protected) -------------------------------------------
app.post("/api/events", requireAuth, async (req, res) => {
  try {
    const { name, detail } = req.body || {};
    if (!name) return res.status(400).json({ error: "Missing event name." });
    await logEvent(req.user.id, name, detail ?? null);
    res.json({ ok: true });
  } catch (err) {
    console.error("POST /api/events failed", err);
    res.status(500).json({ error: "Could not record event." });
  }
});

// ---- Feature routes ---------------------------------------------------------
app.use(referenceRoutes);   // /api/gyms, /api/gyms/:id, /api/plans
app.use(membershipRoutes);  // /api/membership (+ freeze/unfreeze/cancel)
app.use(onboardingRoutes);  // /api/onboarding
app.use(passRoutes);        // /api/pass, /api/pass/token
app.use(accessRoutes);      // /api/access/events (signed webhook)
app.use(activityRoutes);    // /api/activity
app.use(classRoutes);       // /api/classes, /api/bookings (+ book/cancel/waitlist)
app.use(workoutRoutes);     // /api/workouts, /api/sessions/* (guided player)
app.use(routineRoutes);     // /api/routine (+ start/schedule/reschedule/skip/tired-day)
app.use(nutritionRoutes);   // /api/nutrition (+ profile/meals/log/history)
app.use(buddyRoutes);       // /api/buddy (+ invite/respond/sharing/disconnect/support)
app.use(aiRoutes);          // /api/ai/* (chat, consent, history, feedback)

export default app;
