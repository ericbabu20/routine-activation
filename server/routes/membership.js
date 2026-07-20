// Membership management (PRD §11). All queries are scoped to the authenticated
// member's id — never a client-supplied id. No raw card data is ever stored.
import { Router } from "express";
import { admin } from "../supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { logEvent } from "../lib/events.js";

const router = Router();

// GET /api/membership — the member's current (non-cancelled) membership + plan + home centre.
router.get("/api/membership", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { data, error } = await admin
      .from("memberships")
      .select(
        "id, status, started_at, next_billing_at, frozen_until, cancelled_at, home_gym_id, " +
          "plan:membership_plans(id, code, name, description, price_pence, billing_period, includes_all_centres, includes_classes), " +
          "home_gym:gyms(id, name, city)"
      )
      .eq("user_id", userId)
      .neq("status", "cancelled")
      .order("started_at", { ascending: false })
      .maybeSingle();
    if (error) throw error;

    // Invoices (payment records), most recent first.
    const { data: invoices } = await admin
      .from("payment_records")
      .select("id, amount_pence, status, description, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(12);

    res.json({ membership: data, invoices: invoices || [] });
  } catch (err) {
    console.error("GET /api/membership failed", err);
    res.status(500).json({ error: "We couldn't load your membership. Please try again." });
  }
});

// PATCH /api/membership — change home centre (where allowed).
router.patch("/api/membership", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { home_gym_id } = req.body || {};
    if (!home_gym_id) return res.status(400).json({ error: "Missing home_gym_id." });

    const { data, error } = await admin
      .from("memberships")
      .update({ home_gym_id })
      .eq("user_id", userId)
      .neq("status", "cancelled")
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "No active membership found." });

    await admin.from("profiles").update({ home_gym_id }).eq("id", userId);
    res.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/membership failed", err);
    res.status(500).json({ error: "We couldn't update your home centre. Please try again." });
  }
});

// POST /api/membership/freeze — freeze until a date (where eligible).
router.post("/api/membership/freeze", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const until = req.body?.until ? new Date(req.body.until) : new Date(Date.now() + 30 * 864e5);
    const { data, error } = await admin
      .from("memberships")
      .update({ status: "frozen", frozen_until: until.toISOString() })
      .eq("user_id", userId)
      .eq("status", "active")
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(409).json({ error: "Only an active membership can be frozen." });
    await logEvent(userId, "membership_frozen");
    res.json({ ok: true });
  } catch (err) {
    console.error("POST /api/membership/freeze failed", err);
    res.status(500).json({ error: "We couldn't freeze your membership. Please try again." });
  }
});

// POST /api/membership/unfreeze
router.post("/api/membership/unfreeze", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { error } = await admin
      .from("memberships")
      .update({ status: "active", frozen_until: null })
      .eq("user_id", userId)
      .eq("status", "frozen");
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error("POST /api/membership/unfreeze failed", err);
    res.status(500).json({ error: "We couldn't resume your membership. Please try again." });
  }
});

// POST /api/membership/cancel
router.post("/api/membership/cancel", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { error } = await admin
      .from("memberships")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("user_id", userId)
      .neq("status", "cancelled");
    if (error) throw error;
    await logEvent(userId, "membership_cancelled");
    res.json({ ok: true });
  } catch (err) {
    console.error("POST /api/membership/cancel failed", err);
    res.status(500).json({ error: "We couldn't cancel your membership. Please try again." });
  }
});

export default router;
