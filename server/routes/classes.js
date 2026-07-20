// Class discovery & booking (PRD §10). Booking, waitlist join/leave and cancel
// all go through row-locking SQL functions so capacity is never exceeded and
// duplicate / overlapping bookings are rejected atomically.
import { Router } from "express";
import { admin } from "../supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { logEvent } from "../lib/events.js";

const router = Router();

// Friendly messages for the outcomes returned by the SQL booking functions.
const REASONS = {
  unavailable: "This class is no longer available.",
  past: "This class has already started.",
  ineligible: "Your membership doesn't include classes at this centre.",
  duplicate: "You've already booked this class.",
  overlap: "This clashes with another class you've booked.",
  full: "This class is full — join the waitlist for the next spot.",
  not_full: "There are still spots left, so you can book directly.",
  already_booked: "You're already booked into this class.",
  already_waitlisted: "You're already on the waitlist for this class.",
  not_found: "We couldn't find that booking.",
  not_booked: "That booking isn't active.",
};

// GET /api/classes — upcoming sessions with filters + the member's booking state.
router.get("/api/classes", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { gym, date, format, intensity, available } = req.query;

    let q = admin
      .from("class_sessions")
      .select(
        "id, gym_id, starts_at, ends_at, capacity, status, " +
          "class:classes!inner(id, title, description, format, intensity, duration_min, trainer), " +
          "gym:gyms(id, name, city)"
      )
      .eq("status", "scheduled")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(100);

    if (gym) q = q.eq("gym_id", gym);
    if (format) q = q.eq("class.format", format);
    if (intensity) q = q.eq("class.intensity", intensity);
    if (date) {
      const dayStart = new Date(`${date}T00:00:00`).toISOString();
      const dayEnd = new Date(`${date}T23:59:59`).toISOString();
      q = q.gte("starts_at", dayStart).lte("starts_at", dayEnd);
    }

    const { data: sessions, error } = await q;
    if (error) throw error;

    const ids = (sessions || []).map((s) => s.id);
    const bookedCount = {};
    const myBooking = {};
    const myWaitlist = {};

    if (ids.length) {
      const { data: booked } = await admin
        .from("bookings")
        .select("id, user_id, class_session_id")
        .in("class_session_id", ids)
        .eq("status", "booked");
      for (const b of booked || []) {
        bookedCount[b.class_session_id] = (bookedCount[b.class_session_id] || 0) + 1;
        if (b.user_id === userId) myBooking[b.class_session_id] = b.id;
      }
      const { data: waits } = await admin
        .from("waitlist_entries")
        .select("class_session_id, position")
        .in("class_session_id", ids)
        .eq("user_id", userId);
      for (const w of waits || []) myWaitlist[w.class_session_id] = w.position;
    }

    let result = (sessions || []).map((s) => {
      const taken = bookedCount[s.id] || 0;
      const spotsLeft = Math.max(0, s.capacity - taken);
      return {
        id: s.id,
        gym: s.gym,
        starts_at: s.starts_at,
        ends_at: s.ends_at,
        capacity: s.capacity,
        spotsLeft,
        isFull: spotsLeft === 0,
        class: s.class,
        myBookingId: myBooking[s.id] || null,
        myWaitlistPosition: myWaitlist[s.id] ?? null,
      };
    });

    if (available === "true") result = result.filter((s) => !s.isFull);

    res.json({ sessions: result });
  } catch (err) {
    console.error("GET /api/classes failed", err);
    res.status(500).json({ error: "We couldn't load classes. Please try again." });
  }
});

// GET /api/bookings — the member's upcoming & past bookings + waitlists.
router.get("/api/bookings", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { data: bookings } = await admin
      .from("bookings")
      .select(
        "id, status, created_at, " +
          "session:class_sessions(id, starts_at, ends_at, gym:gyms(name, city), class:classes(title, format, intensity, trainer))"
      )
      .eq("user_id", userId)
      .in("status", ["booked", "completed", "missed"])
      .order("created_at", { ascending: false })
      .limit(50);

    const now = Date.now();
    const upcoming = [];
    const past = [];
    for (const b of bookings || []) {
      const start = b.session?.starts_at ? new Date(b.session.starts_at).getTime() : 0;
      if (b.status === "booked" && start >= now) upcoming.push(b);
      else past.push(b);
    }
    upcoming.sort((a, b) => new Date(a.session.starts_at) - new Date(b.session.starts_at));

    const { data: waitlists } = await admin
      .from("waitlist_entries")
      .select("position, session:class_sessions(id, starts_at, ends_at, gym:gyms(name, city), class:classes(title, format, trainer))")
      .eq("user_id", userId);

    res.json({ upcoming, past, waitlists: waitlists || [] });
  } catch (err) {
    console.error("GET /api/bookings failed", err);
    res.status(500).json({ error: "We couldn't load your bookings. Please try again." });
  }
});

// POST /api/classes/:id/book
router.post("/api/classes/:id/book", requireAuth, async (req, res) => {
  try {
    const { data, error } = await admin.rpc("book_class_session", {
      p_user: req.user.id,
      p_session: req.params.id,
    });
    if (error) throw error;
    if (!data?.ok) {
      return res.status(409).json({ error: REASONS[data?.reason] || "We couldn't book that class.", reason: data?.reason });
    }
    await logEvent(req.user.id, "class_booked", { session: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    console.error("POST /api/classes/:id/book failed", err);
    res.status(500).json({ error: "We couldn't book that class. Please try again." });
  }
});

// POST /api/bookings/:id/cancel
router.post("/api/bookings/:id/cancel", requireAuth, async (req, res) => {
  try {
    const { data, error } = await admin.rpc("cancel_booking", {
      p_user: req.user.id,
      p_booking: req.params.id,
    });
    if (error) throw error;
    if (!data?.ok) {
      return res.status(409).json({ error: REASONS[data?.reason] || "We couldn't cancel that booking.", reason: data?.reason });
    }
    await logEvent(req.user.id, "class_cancelled", { booking: req.params.id });
    res.json({ ok: true, promoted: data.promoted });
  } catch (err) {
    console.error("POST /api/bookings/:id/cancel failed", err);
    res.status(500).json({ error: "We couldn't cancel that booking. Please try again." });
  }
});

// POST /api/classes/:id/waitlist
router.post("/api/classes/:id/waitlist", requireAuth, async (req, res) => {
  try {
    const { data, error } = await admin.rpc("join_waitlist", {
      p_user: req.user.id,
      p_session: req.params.id,
    });
    if (error) throw error;
    if (!data?.ok) {
      return res.status(409).json({ error: REASONS[data?.reason] || "We couldn't add you to the waitlist.", reason: data?.reason });
    }
    await logEvent(req.user.id, "waitlist_joined", { session: req.params.id });
    res.json({ ok: true, position: data.position });
  } catch (err) {
    console.error("POST /api/classes/:id/waitlist failed", err);
    res.status(500).json({ error: "We couldn't add you to the waitlist. Please try again." });
  }
});

// DELETE /api/classes/:id/waitlist
router.delete("/api/classes/:id/waitlist", requireAuth, async (req, res) => {
  try {
    const { error } = await admin.rpc("leave_waitlist", {
      p_user: req.user.id,
      p_session: req.params.id,
    });
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/classes/:id/waitlist failed", err);
    res.status(500).json({ error: "We couldn't update the waitlist. Please try again." });
  }
});

export default router;
