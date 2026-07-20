// Meal & calorie support (PRD §7). Members set a goal + dietary preference,
// receive calorie/macro targets, get a daily suggested plan + swaps from the
// meal catalogue, log meals, and track totals. General guidance only — the
// route attaches a non-medical disclaimer the UI must show.
import { Router } from "express";
import { admin } from "../supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { logEvent } from "../lib/events.js";

const router = Router();

const DISCLAIMER =
  "This is general fitness information, not medical or dietary advice. For medical conditions, allergies or an eating disorder, please speak with a qualified professional.";

const GOAL_CALORIES = { lose_weight: 1700, maintain: 2100, general: 2000, gain_muscle: 2500 };

// Split calories into grams: 30% protein, 40% carbs, 30% fat (4/4/9 kcal per g).
function deriveMacros(calories) {
  return {
    protein_target_g: Math.round((calories * 0.3) / 4),
    carbs_target_g: Math.round((calories * 0.4) / 4),
    fat_target_g: Math.round((calories * 0.3) / 9),
  };
}

function allowedDiets(pref) {
  if (pref === "vegan") return ["vegan"];
  if (pref === "vegetarian" || pref === "eggetarian") return ["vegan", "vegetarian"];
  return ["vegan", "vegetarian", "non_veg"];
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function sumTotals(entries) {
  return (entries || []).reduce(
    (t, e) => ({
      calories: t.calories + (e.calories || 0),
      protein_g: t.protein_g + (e.protein_g || 0),
      carbs_g: t.carbs_g + (e.carbs_g || 0),
      fat_g: t.fat_g + (e.fat_g || 0),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );
}

// GET /api/nutrition?date=YYYY-MM-DD — profile, day totals, suggested plan.
router.get("/api/nutrition", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || "") ? req.query.date : todayIso();

    const { data: profile } = await admin
      .from("nutrition_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    const { data: entries } = await admin
      .from("meal_entries")
      .select("id, meal_type, name, calories, protein_g, carbs_g, fat_g")
      .eq("user_id", userId)
      .eq("entry_date", date)
      .order("created_at", { ascending: true });

    const totals = sumTotals(entries);

    // Was a workout completed today? Used for workout-aware suggestions.
    const { data: doneToday } = await admin
      .from("workout_sessions")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "completed")
      .gte("completed_at", `${date}T00:00:00`)
      .lte("completed_at", `${date}T23:59:59`)
      .limit(1);
    const workedOutToday = Boolean(doneToday?.length);

    // Suggested plan: one meal per type, matching the member's diet.
    let plan = [];
    if (profile) {
      const diets = allowedDiets(profile.dietary_preference);
      const { data: meals } = await admin
        .from("meals")
        .select("*")
        .in("diet", diets)
        .order("high_protein", { ascending: false });
      const byType = {};
      for (const m of meals || []) {
        if (!byType[m.meal_type]) byType[m.meal_type] = m; // first (high-protein first) wins
      }
      plan = ["breakfast", "lunch", "dinner", "snack"].map((t) => byType[t]).filter(Boolean);
    }

    const targets = profile
      ? {
          calories: profile.calorie_target,
          protein_g: profile.protein_target_g,
          carbs_g: profile.carbs_target_g,
          fat_g: profile.fat_target_g,
        }
      : null;

    res.json({
      date,
      profile: profile || null,
      targets,
      entries: entries || [],
      totals,
      remaining: targets
        ? {
            calories: targets.calories - totals.calories,
            protein_g: targets.protein_g - totals.protein_g,
            carbs_g: targets.carbs_g - totals.carbs_g,
            fat_g: targets.fat_g - totals.fat_g,
          }
        : null,
      plan,
      workedOutToday,
      disclaimer: DISCLAIMER,
    });
  } catch (err) {
    console.error("GET /api/nutrition failed", err);
    res.status(500).json({ error: "We couldn't load your nutrition. Please try again." });
  }
});

// POST /api/nutrition/profile — set goal, dietary preference and targets.
router.post("/api/nutrition/profile", requireAuth, async (req, res) => {
  try {
    const { goal, dietary_preference, allergies, calorie_target } = req.body || {};
    const validGoals = ["lose_weight", "maintain", "general", "gain_muscle"];
    const validDiets = ["no_preference", "vegetarian", "vegan", "eggetarian", "non_veg"];
    const g = validGoals.includes(goal) ? goal : "general";
    const d = validDiets.includes(dietary_preference) ? dietary_preference : "no_preference";

    let calories = Number(calorie_target);
    if (!Number.isFinite(calories) || calories < 800 || calories > 6000) calories = GOAL_CALORIES[g] || 2000;
    const macros = deriveMacros(calories);

    const row = {
      user_id: req.user.id,
      goal: g,
      dietary_preference: d,
      allergies: Array.isArray(allergies) ? allergies.slice(0, 20) : [],
      calorie_target: calories,
      ...macros,
    };
    const { data, error } = await admin.from("nutrition_profiles").upsert(row).select().single();
    if (error) throw error;
    await logEvent(req.user.id, "nutrition_profile_set", { goal: g, diet: d });
    res.json({ profile: data });
  } catch (err) {
    console.error("POST /api/nutrition/profile failed", err);
    res.status(500).json({ error: "We couldn't save your nutrition profile." });
  }
});

// GET /api/nutrition/meals?type=&diet= — catalogue for swaps / manual add.
router.get("/api/nutrition/meals", requireAuth, async (req, res) => {
  try {
    const { data: profile } = await admin
      .from("nutrition_profiles")
      .select("dietary_preference")
      .eq("user_id", req.user.id)
      .maybeSingle();
    const diets = allowedDiets(profile?.dietary_preference || "no_preference");

    let q = admin.from("meals").select("*").in("diet", diets).order("calories", { ascending: true });
    if (req.query.type) q = q.eq("meal_type", req.query.type);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ meals: data || [] });
  } catch (err) {
    console.error("GET /api/nutrition/meals failed", err);
    res.status(500).json({ error: "We couldn't load meal options." });
  }
});

// POST /api/nutrition/log — log a meal (from the catalogue or entered manually).
router.post("/api/nutrition/log", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const body = req.body || {};
    const date = /^\d{4}-\d{2}-\d{2}$/.test(body.date || "") ? body.date : todayIso();
    const mealType = ["breakfast", "lunch", "dinner", "snack"].includes(body.meal_type) ? body.meal_type : "snack";

    let entry = {
      user_id: userId,
      entry_date: date,
      meal_type: mealType,
      meal_id: null,
      name: (body.name || "").trim(),
      calories: clampNum(body.calories),
      protein_g: clampNum(body.protein_g),
      carbs_g: clampNum(body.carbs_g),
      fat_g: clampNum(body.fat_g),
    };

    // If a catalogue meal is referenced, copy its verified macros server-side
    // (never trust nutrition numbers sent by the browser for a known meal).
    if (body.meal_id) {
      const { data: meal } = await admin.from("meals").select("*").eq("id", body.meal_id).maybeSingle();
      if (!meal) return res.status(404).json({ error: "We couldn't find that meal." });
      entry = {
        ...entry,
        meal_id: meal.id,
        name: meal.name,
        meal_type: meal.meal_type,
        calories: meal.calories,
        protein_g: meal.protein_g,
        carbs_g: meal.carbs_g,
        fat_g: meal.fat_g,
      };
    }

    if (!entry.name) return res.status(400).json({ error: "Please give the meal a name." });

    const { data, error } = await admin.from("meal_entries").insert(entry).select().single();
    if (error) throw error;
    await logEvent(userId, "meal_logged", { meal_type: entry.meal_type });
    res.status(201).json({ entry: data });
  } catch (err) {
    console.error("POST /api/nutrition/log failed", err);
    res.status(500).json({ error: "We couldn't log that meal. Please try again." });
  }
});

// DELETE /api/nutrition/log/:id — remove a logged meal.
router.delete("/api/nutrition/log/:id", requireAuth, async (req, res) => {
  try {
    const { error } = await admin
      .from("meal_entries")
      .delete()
      .eq("id", req.params.id)
      .eq("user_id", req.user.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/nutrition/log/:id failed", err);
    res.status(500).json({ error: "We couldn't remove that meal." });
  }
});

// GET /api/nutrition/history?days=7 — daily calorie/macro totals.
router.get("/api/nutrition/history", requireAuth, async (req, res) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 30);
    const since = new Date();
    since.setDate(since.getDate() - (days - 1));
    const sinceIso = since.toISOString().slice(0, 10);

    const { data: entries } = await admin
      .from("meal_entries")
      .select("entry_date, calories, protein_g, carbs_g, fat_g")
      .eq("user_id", req.user.id)
      .gte("entry_date", sinceIso)
      .order("entry_date", { ascending: true });

    const byDate = {};
    for (const e of entries || []) {
      if (!byDate[e.entry_date]) byDate[e.entry_date] = { date: e.entry_date, calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
      byDate[e.entry_date].calories += e.calories || 0;
      byDate[e.entry_date].protein_g += e.protein_g || 0;
      byDate[e.entry_date].carbs_g += e.carbs_g || 0;
      byDate[e.entry_date].fat_g += e.fat_g || 0;
    }
    res.json({ history: Object.values(byDate) });
  } catch (err) {
    console.error("GET /api/nutrition/history failed", err);
    res.status(500).json({ error: "We couldn't load your nutrition history." });
  }
});

function clampNum(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.floor(n), 10000);
}

export default router;
