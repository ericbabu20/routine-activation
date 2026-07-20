// Onboarding submission (PRD §7). Persists the member's profile, home centre +
// membership, routine preferences, and AI consent. Identity comes from the
// verified session (req.user.id) — never from the request body.
import { Router } from "express";
import { admin } from "../supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { logEvent } from "../lib/events.js";

const router = Router();

const GOALS = new Set([
  "build_strength", "improve_health", "lose_weight",
  "reduce_stress", "build_consistency", "improve_general_fitness",
]);
const EXPERIENCE = new Set(["beginner", "returning", "intermediate", "advanced"]);
const AI_MODES = new Set(["personalised", "faq_only", "disabled"]);

router.post("/api/onboarding", requireAuth, async (req, res) => {
  const userId = req.user.id;
  try {
    const b = req.body || {};

    // ---- Validate ----
    if (!b.name || typeof b.name !== "string") return res.status(400).json({ error: "Please tell us your name." });
    if (b.primary_goal && !GOALS.has(b.primary_goal)) return res.status(400).json({ error: "Invalid goal." });
    if (b.fitness_experience && !EXPERIENCE.has(b.fitness_experience)) return res.status(400).json({ error: "Invalid experience." });
    const aiMode = AI_MODES.has(b.ai_mode) ? b.ai_mode : "disabled";

    // Validate the chosen plan + home centre exist (if provided).
    let planId = b.plan_id || null;
    if (planId) {
      const { data: plan } = await admin.from("membership_plans").select("id").eq("id", planId).maybeSingle();
      if (!plan) return res.status(400).json({ error: "That membership plan is unavailable." });
    }
    let homeGymId = b.home_gym_id || null;
    if (homeGymId) {
      const { data: gym } = await admin.from("gyms").select("id").eq("id", homeGymId).maybeSingle();
      if (!gym) return res.status(400).json({ error: "That centre is unavailable." });
    }

    // ---- Profile ----
    const { error: pErr } = await admin
      .from("profiles")
      .update({
        name: b.name,
        date_of_birth: b.date_of_birth || null,
        phone: b.phone || null,
        fitness_experience: b.fitness_experience || null,
        primary_goal: b.primary_goal || null,
        home_gym_id: homeGymId,
        onboarding_completed: true,
      })
      .eq("id", userId);
    if (pErr) throw pErr;

    // ---- Membership (one active per member) ----
    if (planId) {
      const { data: existing } = await admin
        .from("memberships").select("id").eq("user_id", userId).neq("status", "cancelled").maybeSingle();

      const nextBilling = new Date(Date.now() + 30 * 864e5).toISOString();
      let membershipId = existing?.id;
      if (existing) {
        await admin.from("memberships").update({ plan_id: planId, home_gym_id: homeGymId, status: "active" }).eq("id", existing.id);
      } else {
        const { data: created, error: mErr } = await admin
          .from("memberships")
          .insert({ user_id: userId, plan_id: planId, home_gym_id: homeGymId, status: "active", next_billing_at: nextBilling })
          .select("id")
          .single();
        if (mErr) throw mErr;
        membershipId = created.id;
      }

      // First invoice (test-mode payment, no card data).
      const { data: plan } = await admin.from("membership_plans").select("name, price_pence").eq("id", planId).single();
      await admin.from("payment_records").insert({
        user_id: userId,
        membership_id: membershipId,
        amount_pence: plan.price_pence,
        status: "paid",
        description: `${plan.name} membership — first month`,
        provider: "test",
      });
      await logEvent(userId, "membership_selected", { plan: plan.name });
    }

    // ---- Routine preferences ----
    await admin.from("routine_preferences").upsert({
      user_id: userId,
      preferred_formats: Array.isArray(b.preferred_formats) ? b.preferred_formats : [],
      available_days: Array.isArray(b.available_days) ? b.available_days : [],
      preferred_time: b.preferred_time || null,
      workout_duration: Number.isInteger(b.workout_duration) ? b.workout_duration : null,
      low_energy_periods: b.low_energy_periods || null,
      backup_plan_enabled: b.backup_plan_enabled !== false,
    });

    // ---- AI consent ----
    await admin.from("ai_consent").upsert({
      user_id: userId,
      mode: aiMode,
      retain_history: Boolean(b.ai_retain_history),
      consented_at: aiMode === "disabled" ? null : new Date().toISOString(),
    });

    await logEvent(userId, "onboarding_completed");

    const { data: profile } = await admin.from("profiles").select("*").eq("id", userId).single();
    res.json({ profile });
  } catch (err) {
    console.error("POST /api/onboarding failed", err);
    res.status(500).json({ error: "We couldn't finish setting up your account. Please try again." });
  }
});

export default router;
