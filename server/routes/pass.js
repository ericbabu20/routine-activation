// Secure member pass (PRD §12). The QR pass is generated ON THE SERVER, is
// short-lived, single-use, contains no personal information, and rotates. The
// client only ever renders the opaque token string returned here.
import { Router } from "express";
import crypto from "crypto";
import { admin } from "../supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { logEvent } from "../lib/events.js";

const router = Router();

const TOKEN_TTL_SECONDS = 45; // 30–60s window (PRD §12)

// GET /api/pass — pass header info + active visit + recent visits.
router.get("/api/pass", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: profile } = await admin
      .from("profiles")
      .select("name, email")
      .eq("id", userId)
      .maybeSingle();

    const { data: membership } = await admin
      .from("memberships")
      .select(
        "status, home_gym_id, plan:membership_plans(name, includes_all_centres, includes_classes), home_gym:gyms(name, city)"
      )
      .eq("user_id", userId)
      .neq("status", "cancelled")
      .maybeSingle();

    const { data: activeVisit } = await admin
      .from("visits")
      .select("id, gym_id, check_in_at, gym:gyms(name, city)")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    const { data: recentVisits } = await admin
      .from("visits")
      .select("id, check_in_at, check_out_at, duration_min, status, gym:gyms(name, city)")
      .eq("user_id", userId)
      .order("check_in_at", { ascending: false })
      .limit(5);

    const canEnter = membership?.status === "active";
    res.json({
      member: { name: profile?.name || null, email: profile?.email || null },
      membership: membership || null,
      canEnter,
      activeVisit: activeVisit || null,
      recentVisits: recentVisits || [],
    });
  } catch (err) {
    console.error("GET /api/pass failed", err);
    res.status(500).json({ error: "We couldn't load your pass. Please try again." });
  }
});

// POST /api/pass/token — issue a fresh, short-lived, single-use access token.
router.post("/api/pass/token", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Only an active membership may generate an entry token.
    const { data: membership } = await admin
      .from("memberships")
      .select("status")
      .eq("user_id", userId)
      .neq("status", "cancelled")
      .maybeSingle();

    if (!membership || membership.status !== "active") {
      return res.status(403).json({
        error:
          membership?.status === "frozen"
            ? "Your membership is frozen. Unfreeze it to enter a centre."
            : "An active membership is required to generate a pass.",
      });
    }

    // Opaque, unguessable token — carries no personal data.
    const token = crypto.randomBytes(24).toString("base64url");
    const now = Date.now();
    const expiresAt = new Date(now + TOKEN_TTL_SECONDS * 1000).toISOString();

    const { error } = await admin.from("qr_access_tokens").insert({
      user_id: userId,
      token,
      issued_at: new Date(now).toISOString(),
      expires_at: expiresAt,
    });
    if (error) throw error;

    await logEvent(userId, "pass_token_issued");
    res.json({ token, expires_at: expiresAt, ttl_seconds: TOKEN_TTL_SECONDS });
  } catch (err) {
    console.error("POST /api/pass/token failed", err);
    res.status(500).json({ error: "We couldn't generate your pass. Please try again." });
  }
});

export default router;
