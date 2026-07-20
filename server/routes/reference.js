// Reference data: centres (gyms) and membership plans. Requires an authenticated
// member. No occupancy/busyness is ever computed or returned (PRD §1, §9).
import { Router } from "express";
import { admin } from "../supabase.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// GET /api/gyms?q=search  — list centres, optional text search by name/city/postcode.
router.get("/api/gyms", requireAuth, async (req, res) => {
  try {
    const q = (req.query.q || "").toString().trim();
    let query = admin
      .from("gyms")
      .select("id, name, city, postcode, address, latitude, longitude, accessibility")
      .order("city")
      .order("name");
    if (q) query = query.or(`name.ilike.%${q}%,city.ilike.%${q}%,postcode.ilike.%${q}%`);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ gyms: data });
  } catch (err) {
    console.error("GET /api/gyms failed", err);
    res.status(500).json({ error: "We couldn't load centres. Please try again." });
  }
});

// GET /api/gyms/:id — centre detail with hours + amenities.
router.get("/api/gyms/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const [{ data: gym, error: ge }, { data: hours }, { data: amenities }] = await Promise.all([
      admin.from("gyms").select("*").eq("id", id).maybeSingle(),
      admin.from("gym_hours").select("day_of_week, open_time, close_time, is_closed").eq("gym_id", id).order("day_of_week"),
      admin.from("gym_amenities").select("amenity").eq("gym_id", id),
    ]);
    if (ge) throw ge;
    if (!gym) return res.status(404).json({ error: "Centre not found." });
    res.json({ gym, hours: hours || [], amenities: (amenities || []).map((a) => a.amenity) });
  } catch (err) {
    console.error("GET /api/gyms/:id failed", err);
    res.status(500).json({ error: "We couldn't load that centre. Please try again." });
  }
});

// GET /api/plans — active membership plans (with included centres).
router.get("/api/plans", requireAuth, async (_req, res) => {
  try {
    const { data: plans, error } = await admin
      .from("membership_plans")
      .select("id, code, name, description, price_pence, billing_period, includes_all_centres, includes_classes, sort_order")
      .eq("active", true)
      .order("sort_order");
    if (error) throw error;
    res.json({ plans });
  } catch (err) {
    console.error("GET /api/plans failed", err);
    res.status(500).json({ error: "We couldn't load membership plans. Please try again." });
  }
});

export default router;
