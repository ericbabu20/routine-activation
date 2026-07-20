// Activity & visit history (PRD §13). Read-only, scoped to the signed-in member.
// No occupancy, busyness, or capacity analytics (explicitly out of scope, §29).
import { Router } from "express";
import { admin } from "../supabase.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/api/activity", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const fourWeeksAgo = new Date(now.getTime() - 28 * 864e5).toISOString();

    const { data: visits } = await admin
      .from("visits")
      .select("id, check_in_at, check_out_at, duration_min, status, gym:gyms(name, city)")
      .eq("user_id", userId)
      .order("check_in_at", { ascending: false })
      .limit(60);

    const all = visits || [];
    const completed = all.filter((v) => v.status === "completed");
    const thisMonth = all.filter((v) => v.check_in_at >= monthStart);
    const lastFourWeeks = all.filter((v) => v.check_in_at >= fourWeeksAgo);

    const durations = completed.filter((v) => v.duration_min).map((v) => v.duration_min);
    const avgDuration = durations.length
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : null;

    const stats = {
      totalVisits: all.length,
      visitsThisMonth: thisMonth.length,
      avgPerWeek: Math.round((lastFourWeeks.length / 4) * 10) / 10,
      avgDurationMin: avgDuration,
    };

    res.json({ stats, visits: all.slice(0, 30) });
  } catch (err) {
    console.error("GET /api/activity failed", err);
    res.status(500).json({ error: "We couldn't load your activity. Please try again." });
  }
});

export default router;
