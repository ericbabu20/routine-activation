// Trusted buddy (PRD §6.8): one optional, privacy-first accountability partner.
// The buddy is another Routine member, connected by email with explicit consent.
//
// PRIVACY MATRIX (enforced here): a buddy is only ever shown the owner's
// proposed next workout (title + date), support requests, and confirmation
// status — and only for the fields the owner has chosen to share. Attendance
// history, misses, health, nutrition, visits and notes are NEVER exposed.
import { Router } from "express";
import { admin } from "../supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { logEvent } from "../lib/events.js";

const router = Router();

async function displayName(userId) {
  if (!userId) return null;
  const { data } = await admin.from("profiles").select("name, email").eq("id", userId).maybeSingle();
  return data?.name || data?.email || "A member";
}

async function nextSharedWorkout(ownerId) {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await admin
    .from("scheduled_workouts")
    .select("scheduled_date, workout:workouts(title)")
    .eq("user_id", ownerId)
    .eq("status", "planned")
    .gte("scheduled_date", today)
    .order("scheduled_date", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  // Only the title + date — nothing else about the owner's routine.
  return { title: data.workout?.title || "A workout", date: data.scheduled_date };
}

// GET /api/buddy — the member's own buddy connection + anyone they support.
router.get("/api/buddy", requireAuth, async (req, res) => {
  try {
    const me = req.user.id;

    const { data: own } = await admin
      .from("buddy_connections")
      .select("*")
      .eq("owner_id", me)
      .in("status", ["pending", "active"])
      .maybeSingle();

    let connection = null;
    if (own) {
      connection = {
        id: own.id,
        buddyEmail: own.buddy_email,
        buddyName: await displayName(own.buddy_id),
        relationship: own.relationship,
        status: own.status,
        muted: own.muted,
        share_next_workout: own.share_next_workout,
        share_support_requests: own.share_support_requests,
        share_confirmation: own.share_confirmation,
      };
    }

    // Connections where I am the buddy (I give support).
    const { data: asBuddy } = await admin
      .from("buddy_connections")
      .select("*")
      .eq("buddy_id", me)
      .in("status", ["pending", "active"])
      .order("created_at", { ascending: false });

    const supporting = [];
    for (const c of asBuddy || []) {
      const entry = {
        id: c.id,
        ownerName: await displayName(c.owner_id),
        relationship: c.relationship,
        status: c.status,
        sharedNextWorkout: null,
        supportRequests: [],
      };
      if (c.status === "active") {
        if (c.share_next_workout) entry.sharedNextWorkout = await nextSharedWorkout(c.owner_id);
        if (c.share_support_requests) {
          const { data: reqs } = await admin
            .from("buddy_support_requests")
            .select("id, workout_title, workout_date, message, status, created_at, confirmed_at")
            .eq("connection_id", c.id)
            .order("created_at", { ascending: false })
            .limit(10);
          entry.supportRequests = reqs || [];
        }
      }
      supporting.push(entry);
    }

    res.json({ connection, supporting });
  } catch (err) {
    console.error("GET /api/buddy failed", err);
    res.status(500).json({ error: "We couldn't load your buddy details. Please try again." });
  }
});

// POST /api/buddy/invite — invite another member by email (explicit consent).
router.post("/api/buddy/invite", requireAuth, async (req, res) => {
  try {
    const me = req.user.id;
    const b = req.body || {};
    if (b.consent !== true) return res.status(400).json({ error: "Please confirm you consent to sharing the listed information." });

    const email = String(b.email || "").trim().toLowerCase();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: "Please enter a valid email address." });
    if (email === String(req.user.email || "").toLowerCase()) return res.status(400).json({ error: "You can't add yourself as a buddy." });

    const { data: target } = await admin.from("profiles").select("id").ilike("email", email).maybeSingle();
    if (!target) return res.status(404).json({ error: "That email isn't a Routine member yet. Ask them to sign up first, then invite them." });

    const row = {
      owner_id: me,
      buddy_id: target.id,
      buddy_email: email,
      relationship: (b.relationship || "").toString().slice(0, 60) || null,
      status: "pending",
      share_next_workout: b.share_next_workout !== false,
      share_support_requests: b.share_support_requests !== false,
      share_confirmation: b.share_confirmation !== false,
    };
    const { data, error } = await admin.from("buddy_connections").insert(row).select("id").single();
    if (error) {
      if (error.code === "23505") return res.status(409).json({ error: "You already have a buddy invitation or connection. Disconnect it first." });
      throw error;
    }
    await logEvent(me, "buddy_invite_sent", { connection: data.id });
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error("POST /api/buddy/invite failed", err);
    res.status(500).json({ error: "We couldn't send that invitation. Please try again." });
  }
});

// POST /api/buddy/:id/respond — the invited buddy accepts or declines.
router.post("/api/buddy/:id/respond", requireAuth, async (req, res) => {
  try {
    const accept = req.body?.accept === true;
    const { data: conn } = await admin
      .from("buddy_connections")
      .select("id, buddy_id, status")
      .eq("id", req.params.id)
      .maybeSingle();
    if (!conn || conn.buddy_id !== req.user.id) return res.status(404).json({ error: "We couldn't find that invitation." });
    if (conn.status !== "pending") return res.status(409).json({ error: "That invitation has already been answered." });

    const { error } = await admin
      .from("buddy_connections")
      .update({ status: accept ? "active" : "declined", responded_at: new Date().toISOString() })
      .eq("id", conn.id);
    if (error) throw error;
    if (accept) await logEvent(req.user.id, "buddy_invite_accepted", { connection: conn.id });
    res.json({ ok: true });
  } catch (err) {
    console.error("POST /api/buddy/:id/respond failed", err);
    res.status(500).json({ error: "We couldn't update that invitation." });
  }
});

// POST /api/buddy/:id/sharing — owner adjusts sharing controls + mute.
router.post("/api/buddy/:id/sharing", requireAuth, async (req, res) => {
  try {
    const b = req.body || {};
    const patch = {};
    for (const k of ["share_next_workout", "share_support_requests", "share_confirmation", "muted"]) {
      if (typeof b[k] === "boolean") patch[k] = b[k];
    }
    if (!Object.keys(patch).length) return res.status(400).json({ error: "Nothing to update." });
    const { data, error } = await admin
      .from("buddy_connections")
      .update(patch)
      .eq("id", req.params.id)
      .eq("owner_id", req.user.id) // only the owner controls sharing
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "We couldn't find that connection." });
    res.json({ ok: true });
  } catch (err) {
    console.error("POST /api/buddy/:id/sharing failed", err);
    res.status(500).json({ error: "We couldn't update your sharing settings." });
  }
});

// POST /api/buddy/:id/disconnect — either party can end the connection.
router.post("/api/buddy/:id/disconnect", requireAuth, async (req, res) => {
  try {
    const me = req.user.id;
    const { data, error } = await admin
      .from("buddy_connections")
      .update({ status: "revoked" })
      .eq("id", req.params.id)
      .or(`owner_id.eq.${me},buddy_id.eq.${me}`)
      .in("status", ["pending", "active"])
      .select("owner_id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "We couldn't find that connection." });
    if (data.owner_id === me) await logEvent(me, "buddy_consent_revoked", { connection: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    console.error("POST /api/buddy/:id/disconnect failed", err);
    res.status(500).json({ error: "We couldn't disconnect that buddy." });
  }
});

// POST /api/buddy/request-support — owner asks their buddy to cheer on next session.
router.post("/api/buddy/request-support", requireAuth, async (req, res) => {
  try {
    const me = req.user.id;
    const { data: conn } = await admin
      .from("buddy_connections")
      .select("id, buddy_id, status, share_support_requests")
      .eq("owner_id", me)
      .eq("status", "active")
      .maybeSingle();
    if (!conn) return res.status(409).json({ error: "You don't have an active buddy yet." });
    if (!conn.share_support_requests) return res.status(409).json({ error: "Turn on sharing support requests first." });

    const next = await nextSharedWorkout(me);
    const { error } = await admin.from("buddy_support_requests").insert({
      connection_id: conn.id,
      owner_id: me,
      buddy_id: conn.buddy_id,
      workout_title: next?.title || "A workout",
      workout_date: next?.date || null,
      message: (req.body?.message || "").toString().slice(0, 280) || null,
    });
    if (error) throw error;
    await logEvent(me, "buddy_request_sent", { connection: conn.id });
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error("POST /api/buddy/request-support failed", err);
    res.status(500).json({ error: "We couldn't send that support request." });
  }
});

// POST /api/buddy/support/:id/confirm — buddy confirms they'll cheer them on.
router.post("/api/buddy/support/:id/confirm", requireAuth, async (req, res) => {
  try {
    const { data, error } = await admin
      .from("buddy_support_requests")
      .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .eq("buddy_id", req.user.id) // only the buddy can confirm
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "We couldn't find that support request." });
    res.json({ ok: true });
  } catch (err) {
    console.error("POST /api/buddy/support/:id/confirm failed", err);
    res.status(500).json({ error: "We couldn't confirm that." });
  }
});

export default router;
