// Seeds reference data (gyms/centres + membership plans) into Supabase.
// Idempotent: safe to run multiple times (upserts by natural keys).
// Reads credentials from .env (never from the command line).
//
//   node scripts/seed.js   (or: npm run seed)
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY in .env");
  process.exit(1);
}
const admin = createClient(url, key, { auth: { persistSession: false } });

// ---- Centres ----------------------------------------------------------------
const GYMS = [
  {
    name: "Indiranagar Centre", city: "Bengaluru", postcode: "560038",
    address: "100 Feet Rd, Indiranagar", latitude: 12.9719, longitude: 77.6412,
    accessibility: "Step-free access, accessible changing room and lift.",
    amenities: ["Strength zone", "Cardio zone", "Group class studio", "Showers", "Lockers"],
  },
  {
    name: "Koramangala Centre", city: "Bengaluru", postcode: "560095",
    address: "80 Feet Rd, Koramangala", latitude: 12.9352, longitude: 77.6245,
    accessibility: "Step-free access and accessible toilets.",
    amenities: ["Strength zone", "Functional area", "Yoga studio", "Showers", "Parking"],
  },
  {
    name: "HSR Layout Centre", city: "Bengaluru", postcode: "560102",
    address: "27th Main Rd, HSR Layout", latitude: 12.9116, longitude: 77.6389,
    accessibility: "Ground-floor studio, step-free access.",
    amenities: ["Strength zone", "Cardio zone", "Dance studio", "Showers", "Lockers"],
  },
  {
    name: "Bandra Centre", city: "Mumbai", postcode: "400050",
    address: "Linking Rd, Bandra West", latitude: 19.0607, longitude: 72.8362,
    accessibility: "Lift access to studio floor, accessible changing room.",
    amenities: ["Strength zone", "HIIT studio", "Recovery lounge", "Showers"],
  },
  {
    name: "Powai Centre", city: "Mumbai", postcode: "400076",
    address: "Hiranandani Gardens, Powai", latitude: 19.1197, longitude: 72.9051,
    accessibility: "Step-free access throughout.",
    amenities: ["Strength zone", "Cardio zone", "Yoga studio", "Lockers", "Parking"],
  },
  {
    name: "Connaught Place Centre", city: "New Delhi", postcode: "110001",
    address: "Inner Circle, Connaught Place", latitude: 28.6315, longitude: 77.2167,
    accessibility: "Accessible entrance and lift.",
    amenities: ["Strength zone", "Functional area", "Group class studio", "Showers", "Lockers"],
  },
];

// ---- Opening hours (applied to every gym): Mon–Fri 06–22, Sat–Sun 07–20 ------
function hoursForGym(gymId) {
  const rows = [];
  for (let d = 0; d <= 6; d++) {
    const weekend = d === 0 || d === 6;
    rows.push({
      gym_id: gymId,
      day_of_week: d,
      open_time: weekend ? "07:00" : "06:00",
      close_time: weekend ? "20:00" : "22:00",
      is_closed: false,
    });
  }
  return rows;
}

// ---- Membership plans -------------------------------------------------------
const PLANS = [
  {
    code: "home", name: "Home", description: "Home workouts and the 45-day routine builder. No centre access.",
    price_pence: 79900, billing_period: "monthly",
    includes_all_centres: false, includes_classes: false, sort_order: 1,
  },
  {
    code: "pro", name: "Pro", description: "Your home centre, all classes there, plus home workouts.",
    price_pence: 129900, billing_period: "monthly",
    includes_all_centres: false, includes_classes: true, sort_order: 2,
  },
  {
    code: "elite", name: "Elite", description: "Access to every centre and class, plus home workouts.",
    price_pence: 199900, billing_period: "monthly",
    includes_all_centres: true, includes_classes: true, sort_order: 3,
  },
];

async function upsertGyms() {
  for (const g of GYMS) {
    const { amenities, ...gym } = g;
    // Find existing by name+city to stay idempotent.
    const { data: existing } = await admin
      .from("gyms").select("id").eq("name", gym.name).eq("city", gym.city).maybeSingle();

    let gymId = existing?.id;
    if (gymId) {
      await admin.from("gyms").update(gym).eq("id", gymId);
    } else {
      const { data, error } = await admin.from("gyms").insert(gym).select("id").single();
      if (error) throw error;
      gymId = data.id;
    }

    await admin.from("gym_hours").delete().eq("gym_id", gymId);
    await admin.from("gym_hours").insert(hoursForGym(gymId));

    await admin.from("gym_amenities").delete().eq("gym_id", gymId);
    await admin.from("gym_amenities").insert(amenities.map((a) => ({ gym_id: gymId, amenity: a })));

    console.log(`   gym: ${gym.name} (${gym.city})`);
  }
}

async function upsertPlans() {
  for (const p of PLANS) {
    const { error } = await admin.from("membership_plans").upsert(p, { onConflict: "code" });
    if (error) throw error;
    console.log(`   plan: ${p.name}`);
  }
}

// ---- Classes (offering templates) ------------------------------------------
const CLASSES = [
  { title: "Strength Foundations", description: "Build full-body strength with guided compound lifts.", format: "Strength", intensity: "moderate", duration_min: 45, trainer: "Aarav", capacity: 16 },
  { title: "HIIT Burn", description: "High-intensity intervals to lift your heart rate and energy.", format: "HIIT", intensity: "high", duration_min: 30, trainer: "Priya", capacity: 20 },
  { title: "Vinyasa Yoga", description: "Flowing yoga to build mobility and calm.", format: "Yoga", intensity: "low", duration_min: 45, trainer: "Meera", capacity: 24 },
  { title: "Cardio Kick", description: "Dance-inspired cardio that's easy to follow.", format: "Cardio", intensity: "moderate", duration_min: 45, trainer: "Rohan", capacity: 22 },
  { title: "Mobility & Recovery", description: "Gentle mobility work to help you recover well.", format: "Mobility", intensity: "low", duration_min: 30, trainer: "Sana", capacity: 18 },
];

async function upsertClasses() {
  const map = {};
  for (const c of CLASSES) {
    const { capacity, ...cls } = c; // capacity lives on class_sessions, not classes
    const { data: existing } = await admin.from("classes").select("id").eq("title", cls.title).maybeSingle();
    let id = existing?.id;
    if (existing) {
      await admin.from("classes").update(cls).eq("id", existing.id);
    } else {
      const { data, error } = await admin.from("classes").insert(cls).select("id").single();
      if (error) throw error;
      id = data.id;
    }
    map[c.title] = { id, ...c }; // keep capacity in the map for session creation
  }
  return map;
}

// Schedule sessions for the next 10 days across all gyms.
async function seedSessions(classMap) {
  const { data: gyms } = await admin.from("gyms").select("id, name");
  if (!gyms?.length) return;

  // Clear future scheduled sessions to stay idempotent (leaves past history intact).
  await admin.from("class_sessions").delete().gt("starts_at", new Date().toISOString());

  const times = ["07:00", "12:30", "18:30"]; // three slots a day
  const classList = Object.values(classMap);
  const rows = [];
  const now = new Date();
  let ci = 0;
  for (const gym of gyms) {
    for (let d = 1; d <= 10; d++) {
      const day = new Date(now);
      day.setDate(now.getDate() + d);
      for (const t of times) {
        const cls = classList[ci % classList.length];
        ci++;
        const [hh, mm] = t.split(":").map(Number);
        const start = new Date(day);
        start.setHours(hh, mm, 0, 0);
        const end = new Date(start.getTime() + cls.duration_min * 60000);
        rows.push({
          class_id: cls.id,
          gym_id: gym.id,
          starts_at: start.toISOString(),
          ends_at: end.toISOString(),
          capacity: cls.capacity,
          status: "scheduled",
        });
      }
    }
  }
  // Insert in chunks.
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await admin.from("class_sessions").insert(rows.slice(i, i + 200));
    if (error) throw error;
  }
  console.log(`   sessions: ${rows.length} scheduled across ${gyms.length} centres`);
}

// ---- Workout library (catalogue templates + their exercises) ----------------
const WORKOUTS = [
  {
    title: "Full-Body Strength Starter", workout_type: "strength", goal: "build_strength",
    difficulty: "beginner", duration_min: 30, equipment: ["Dumbbells"], is_short: false,
    description: "A gentle introduction to the main strength movements, at a pace you control.",
    exercises: [
      { name: "Bodyweight squats", instructions: "Keep your chest up and sit back into your heels.", sets: 3, reps: 12, rest_sec: 45 },
      { name: "Incline push-ups", instructions: "Hands on a bench; lower with control.", sets: 3, reps: 10, rest_sec: 45 },
      { name: "Dumbbell rows", instructions: "Pull the weight to your ribs, squeeze the shoulder blade.", sets: 3, reps: 10, rest_sec: 45 },
      { name: "Glute bridges", instructions: "Drive through the heels, pause at the top.", sets: 3, reps: 12, rest_sec: 30 },
    ],
  },
  {
    title: "Strength Builder", workout_type: "strength", goal: "build_strength",
    difficulty: "intermediate", duration_min: 45, equipment: ["Barbell", "Dumbbells"], is_short: false,
    description: "Compound lifts to build strength across the whole body.",
    exercises: [
      { name: "Goblet squats", instructions: "Hold a dumbbell at your chest; keep it tall.", sets: 4, reps: 8, rest_sec: 60 },
      { name: "Dumbbell bench press", instructions: "Lower to mid-chest, press evenly.", sets: 4, reps: 8, rest_sec: 60 },
      { name: "Romanian deadlifts", instructions: "Soft knees, hinge at the hips.", sets: 3, reps: 10, rest_sec: 60 },
      { name: "Bent-over rows", instructions: "Flat back, pull to the belly.", sets: 3, reps: 10, rest_sec: 60 },
    ],
  },
  {
    title: "HIIT Express", workout_type: "hiit", goal: "lose_weight",
    difficulty: "intermediate", duration_min: 20, equipment: [], is_short: true,
    description: "Short, sweaty intervals you can do anywhere.",
    exercises: [
      { name: "Jumping jacks", instructions: "Steady rhythm, land softly.", duration_sec: 40, rest_sec: 20 },
      { name: "Mountain climbers", instructions: "Hips low, drive the knees.", duration_sec: 40, rest_sec: 20 },
      { name: "Squat to press", instructions: "Use body weight or light dumbbells.", duration_sec: 40, rest_sec: 20 },
      { name: "High knees", instructions: "Quick feet, pump the arms.", duration_sec: 40, rest_sec: 20 },
    ],
  },
  {
    title: "Fat-Burn Cardio", workout_type: "cardio", goal: "lose_weight",
    difficulty: "beginner", duration_min: 35, equipment: [], is_short: false,
    description: "Low-impact cardio that keeps your heart rate up without the pounding.",
    exercises: [
      { name: "Marching in place", instructions: "Warm up with a steady march.", duration_sec: 120, rest_sec: 30 },
      { name: "Step touch", instructions: "Side to side, add arms.", duration_sec: 90, rest_sec: 30 },
      { name: "Low-impact burpees", instructions: "Step back instead of jumping.", sets: 3, reps: 10, rest_sec: 45 },
      { name: "Fast walk / jog", instructions: "Keep a pace you can just about talk at.", duration_sec: 300, rest_sec: 0 },
    ],
  },
  {
    title: "Sunrise Mobility", workout_type: "mobility", goal: "improve_general_fitness",
    difficulty: "beginner", duration_min: 15, equipment: ["Mat"], is_short: true,
    description: "A short mobility flow to loosen up and feel good.",
    exercises: [
      { name: "Cat-cow", instructions: "Move slowly with your breath.", duration_sec: 60, rest_sec: 15 },
      { name: "World's greatest stretch", instructions: "Open through the hips and spine.", duration_sec: 60, rest_sec: 15 },
      { name: "Shoulder circles", instructions: "Big, slow circles both ways.", duration_sec: 45, rest_sec: 15 },
      { name: "Standing hamstring reach", instructions: "Soft knees, reach with a long spine.", duration_sec: 45, rest_sec: 15 },
    ],
  },
  {
    title: "Calm Evening Yoga", workout_type: "yoga", goal: "reduce_stress",
    difficulty: "beginner", duration_min: 25, equipment: ["Mat"], is_short: false,
    description: "A relaxing flow to wind down and release tension.",
    exercises: [
      { name: "Child's pose", instructions: "Breathe into your back.", duration_sec: 90, rest_sec: 10 },
      { name: "Downward dog", instructions: "Pedal the heels, lengthen the spine.", duration_sec: 60, rest_sec: 10 },
      { name: "Low lunge", instructions: "Sink the hips, lift the chest.", duration_sec: 60, rest_sec: 10 },
      { name: "Seated forward fold", instructions: "Fold from the hips, no forcing.", duration_sec: 90, rest_sec: 10 },
    ],
  },
  {
    title: "Recovery Reset", workout_type: "recovery", goal: "reduce_stress",
    difficulty: "beginner", duration_min: 15, equipment: ["Foam roller"], is_short: true,
    description: "Gentle recovery work for a tired or low-energy day.",
    exercises: [
      { name: "Foam roll quads", instructions: "Slow passes, pause on tender spots.", duration_sec: 60, rest_sec: 15 },
      { name: "Foam roll back", instructions: "Support your head, roll the upper back.", duration_sec: 60, rest_sec: 15 },
      { name: "Deep breathing", instructions: "4 counts in, 6 counts out.", duration_sec: 120, rest_sec: 0 },
    ],
  },
  {
    title: "Consistency Circuit", workout_type: "strength", goal: "build_consistency",
    difficulty: "beginner", duration_min: 25, equipment: ["Dumbbells"], is_short: true,
    description: "A simple, repeatable circuit that's easy to come back to.",
    exercises: [
      { name: "Squats", instructions: "Controlled tempo.", sets: 3, reps: 12, rest_sec: 30 },
      { name: "Push-ups (any level)", instructions: "On knees or incline is perfect.", sets: 3, reps: 8, rest_sec: 30 },
      { name: "Dumbbell rows", instructions: "One arm at a time.", sets: 3, reps: 10, rest_sec: 30 },
      { name: "Plank", instructions: "Hold a straight line.", duration_sec: 30, rest_sec: 30 },
    ],
  },
  {
    title: "Heart-Health Intervals", workout_type: "cardio", goal: "improve_health",
    difficulty: "intermediate", duration_min: 30, equipment: [], is_short: false,
    description: "Moderate intervals to support cardiovascular health.",
    exercises: [
      { name: "Brisk walk warm-up", instructions: "Ease in for a few minutes.", duration_sec: 180, rest_sec: 0 },
      { name: "Jog / fast walk intervals", instructions: "1 min faster, 1 min easy. Repeat.", duration_sec: 360, rest_sec: 0 },
      { name: "Bodyweight squats", instructions: "Keep moving between intervals.", sets: 2, reps: 15, rest_sec: 30 },
      { name: "Cool-down walk", instructions: "Slow it right down.", duration_sec: 180, rest_sec: 0 },
    ],
  },
];

async function upsertWorkouts() {
  for (const w of WORKOUTS) {
    const { exercises, ...workout } = w;
    const { data: existing } = await admin.from("workouts").select("id").eq("title", workout.title).maybeSingle();
    let id = existing?.id;
    if (existing) {
      await admin.from("workouts").update(workout).eq("id", existing.id);
    } else {
      const { data, error } = await admin.from("workouts").insert(workout).select("id").single();
      if (error) throw error;
      id = data.id;
    }
    // Replace the exercise list to stay idempotent.
    await admin.from("workout_exercises").delete().eq("workout_id", id);
    await admin.from("workout_exercises").insert(
      exercises.map((e, i) => ({
        workout_id: id,
        position: i + 1,
        name: e.name,
        instructions: e.instructions ?? null,
        sets: e.sets ?? null,
        reps: e.reps ?? null,
        duration_sec: e.duration_sec ?? null,
        rest_sec: e.rest_sec ?? 30,
      }))
    );
    console.log(`   workout: ${workout.title}`);
  }
}

// ---- Meal catalogue (reference data for plan + swaps) -----------------------
const MEALS = [
  // Breakfast
  { name: "Veg poha", description: "Flattened rice with peas and peanuts.", meal_type: "breakfast", diet: "vegan", calories: 320, protein_g: 8, carbs_g: 52, fat_g: 9 },
  { name: "Greek yoghurt & berries", description: "High-protein yoghurt with mixed berries.", meal_type: "breakfast", diet: "vegetarian", calories: 280, protein_g: 22, carbs_g: 30, fat_g: 7, high_protein: true },
  { name: "Egg white omelette", description: "Egg whites with spinach and tomato.", meal_type: "breakfast", diet: "vegetarian", calories: 240, protein_g: 26, carbs_g: 8, fat_g: 10, high_protein: true },
  { name: "Chicken sausage & eggs", description: "Two eggs with lean chicken sausage.", meal_type: "breakfast", diet: "non_veg", calories: 360, protein_g: 30, carbs_g: 6, fat_g: 22, high_protein: true },
  // Lunch
  { name: "Rajma chawal", description: "Kidney bean curry with brown rice.", meal_type: "lunch", diet: "vegan", calories: 520, protein_g: 18, carbs_g: 82, fat_g: 12 },
  { name: "Paneer bowl", description: "Grilled paneer with quinoa and veg.", meal_type: "lunch", diet: "vegetarian", calories: 560, protein_g: 32, carbs_g: 48, fat_g: 26, high_protein: true },
  { name: "Grilled chicken salad", description: "Chicken breast, greens and olive oil.", meal_type: "lunch", diet: "non_veg", calories: 450, protein_g: 42, carbs_g: 20, fat_g: 22, high_protein: true },
  { name: "Tofu stir-fry", description: "Tofu and vegetables with rice.", meal_type: "lunch", diet: "vegan", calories: 480, protein_g: 24, carbs_g: 58, fat_g: 16, high_protein: true },
  // Dinner
  { name: "Dal & roti", description: "Lentils with two whole-wheat rotis.", meal_type: "dinner", diet: "vegan", calories: 440, protein_g: 20, carbs_g: 66, fat_g: 10 },
  { name: "Fish curry & rice", description: "Light fish curry with steamed rice.", meal_type: "dinner", diet: "non_veg", calories: 520, protein_g: 38, carbs_g: 55, fat_g: 16, high_protein: true },
  { name: "Chickpea curry", description: "Chana masala with a small portion of rice.", meal_type: "dinner", diet: "vegan", calories: 470, protein_g: 19, carbs_g: 70, fat_g: 12 },
  { name: "Paneer tikka & salad", description: "Baked paneer tikka with a fresh salad.", meal_type: "dinner", diet: "vegetarian", calories: 420, protein_g: 30, carbs_g: 18, fat_g: 24, high_protein: true },
  // Snacks
  { name: "Roasted chana", description: "Roasted chickpeas, lightly spiced.", meal_type: "snack", diet: "vegan", calories: 180, protein_g: 10, carbs_g: 26, fat_g: 4 },
  { name: "Protein shake", description: "Whey protein with water or milk.", meal_type: "snack", diet: "vegetarian", calories: 160, protein_g: 25, carbs_g: 6, fat_g: 3, high_protein: true },
  { name: "Fruit & nuts", description: "An apple with a small handful of almonds.", meal_type: "snack", diet: "vegan", calories: 220, protein_g: 6, carbs_g: 28, fat_g: 12 },
  { name: "Boiled eggs", description: "Two boiled eggs.", meal_type: "snack", diet: "vegetarian", calories: 140, protein_g: 12, carbs_g: 1, fat_g: 10, high_protein: true },
];

async function upsertMeals() {
  for (const m of MEALS) {
    const meal = { high_protein: false, ...m };
    const { data: existing } = await admin.from("meals").select("id").eq("name", meal.name).eq("meal_type", meal.meal_type).maybeSingle();
    if (existing) {
      await admin.from("meals").update(meal).eq("id", existing.id);
    } else {
      const { error } = await admin.from("meals").insert(meal);
      if (error) throw error;
    }
  }
  console.log(`   meals: ${MEALS.length}`);
}

async function main() {
  console.log("\n  Seeding reference data...");
  await upsertGyms();
  await upsertPlans();
  const classMap = await upsertClasses();
  console.log(`   classes: ${Object.keys(classMap).length}`);
  await seedSessions(classMap);
  await upsertWorkouts();
  await upsertMeals();
  console.log("\n  Reference data seeded.\n");
}

main().catch((err) => {
  console.error("\n  Seed failed:", err.message, "\n");
  process.exit(1);
});
