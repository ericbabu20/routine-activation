// Deterministic read tools for the assistant (PRD §23). Gemini can REQUEST these
// via function calling but never executes database code itself. Every handler:
//   - uses the server-verified member id (never an id from the chat),
//   - applies an ownership filter,
//   - returns only the minimum necessary fields, and
//   - records that the tool was invoked (name only — never chat content).
import { Type } from "@google/genai";
import { admin } from "../supabase.js";
import { logEvent } from "./events.js";
import { retrieve } from "./rag.js";

// ---- Tool declarations (sent to Gemini) ------------------------------------
export const toolDeclarations = [
  { name: "get_member_profile", description: "The member's name, primary fitness goal, experience level and home centre.", parameters: { type: Type.OBJECT, properties: {} } },
  { name: "get_membership_summary", description: "The member's membership plan, status, what it includes and next billing date.", parameters: { type: Type.OBJECT, properties: {} } },
  { name: "get_current_routine", description: "The member's routine preferences (formats, days, times, duration) and whether a 45-day routine is active.", parameters: { type: Type.OBJECT, properties: {} } },
  { name: "get_routine_progress", description: "Progress toward the 45-day activation target (eligible workouts and active weeks).", parameters: { type: Type.OBJECT, properties: {} } },
  { name: "get_upcoming_schedule", description: "The member's upcoming booked classes ordered by time.", parameters: { type: Type.OBJECT, properties: {} } },
  { name: "get_upcoming_bookings", description: "The member's upcoming class bookings and any waitlist positions.", parameters: { type: Type.OBJECT, properties: {} } },
  { name: "get_recent_workouts", description: "The member's recent completed classes and gym visits.", parameters: { type: Type.OBJECT, properties: {} } },
  { name: "get_visit_summary", description: "How often the member has visited (this month, total, average duration).", parameters: { type: Type.OBJECT, properties: {} } },
  { name: "get_notification_preferences", description: "The member's notification preferences.", parameters: { type: Type.OBJECT, properties: {} } },
  {
    name: "search_workout_library",
    description: "Search approved workout and equipment guidance for relevant options or how-tos.",
    parameters: { type: Type.OBJECT, properties: { query: { type: Type.STRING, description: "What to search for" } }, required: ["query"] },
  },
  {
    name: "search_help_content",
    description: "Search approved help-centre content: FAQs, membership, cancellation and safety policies.",
    parameters: { type: Type.OBJECT, properties: { query: { type: Type.STRING, description: "What to search for" } }, required: ["query"] },
  },
];

const nowIso = () => new Date().toISOString();

// ---- Handlers --------------------------------------------------------------
const handlers = {
  async get_member_profile(userId) {
    const { data: p } = await admin
      .from("profiles")
      .select("name, primary_goal, fitness_experience, home_gym:gyms(name, city)")
      .eq("id", userId)
      .maybeSingle();
    if (!p) return { found: false };
    return {
      name: p.name,
      primary_goal: p.primary_goal,
      fitness_experience: p.fitness_experience,
      home_centre: p.home_gym ? `${p.home_gym.name}, ${p.home_gym.city}` : null,
    };
  },

  async get_membership_summary(userId) {
    const { data: m } = await admin
      .from("memberships")
      .select("status, next_billing_at, frozen_until, plan:membership_plans(name, includes_all_centres, includes_classes), home_gym:gyms(name, city)")
      .eq("user_id", userId)
      .neq("status", "cancelled")
      .maybeSingle();
    if (!m) return { has_membership: false };
    return {
      has_membership: true,
      plan: m.plan?.name,
      status: m.status,
      includes_all_centres: m.plan?.includes_all_centres,
      includes_classes: m.plan?.includes_classes,
      home_centre: m.home_gym ? `${m.home_gym.name}, ${m.home_gym.city}` : null,
      next_billing_at: m.next_billing_at,
      frozen_until: m.frozen_until,
    };
  },

  async get_current_routine(userId) {
    const { data: prefs } = await admin
      .from("routine_preferences")
      .select("preferred_formats, available_days, preferred_time, workout_duration, low_energy_periods, backup_plan_enabled")
      .eq("user_id", userId)
      .maybeSingle();
    // The full 45-day routine engine is a later phase; report preferences honestly.
    return {
      active_45_day_routine: false,
      note: "A structured 45-day routine isn't set up yet; these are the member's stated preferences.",
      preferred_formats: prefs?.preferred_formats || [],
      available_days: prefs?.available_days || [],
      preferred_time: prefs?.preferred_time || null,
      workout_duration_min: prefs?.workout_duration || null,
      low_energy_periods: prefs?.low_energy_periods || null,
      backup_plan_enabled: prefs?.backup_plan_enabled ?? true,
    };
  },

  async get_routine_progress(userId) {
    // Proxy from real attendance until the routine engine lands.
    const { data: visits } = await admin
      .from("visits")
      .select("check_in_at, status")
      .eq("user_id", userId)
      .order("check_in_at", { ascending: false })
      .limit(200);
    const { count: completed } = await admin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "completed");
    const weeks = new Set((visits || []).map((v) => {
      const d = new Date(v.check_in_at);
      const onejan = new Date(d.getFullYear(), 0, 1);
      return `${d.getFullYear()}-${Math.ceil(((d - onejan) / 864e5 + onejan.getDay() + 1) / 7)}`;
    }));
    return {
      activation_target: { eligible_workouts: 8, distinct_active_weeks: 4, window_days: 45 },
      note: "Full 45-day routine tracking arrives with the Routine feature. This is attendance so far.",
      completed_classes: completed || 0,
      total_visits: (visits || []).length,
      active_weeks_so_far: weeks.size,
    };
  },

  async get_upcoming_schedule(userId) {
    const { data } = await admin
      .from("bookings")
      .select("session:class_sessions(starts_at, ends_at, gym:gyms(name), class:classes(title, format, trainer))")
      .eq("user_id", userId)
      .eq("status", "booked")
      .order("created_at", { ascending: false })
      .limit(20);
    const upcoming = (data || [])
      .map((b) => b.session)
      .filter((s) => s && new Date(s.starts_at).getTime() >= Date.now())
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))
      .slice(0, 5)
      .map((s) => ({ title: s.class?.title, format: s.class?.format, trainer: s.class?.trainer, starts_at: s.starts_at, centre: s.gym?.name }));
    return { upcoming };
  },

  async get_upcoming_bookings(userId) {
    const { data: bookings } = await admin
      .from("bookings")
      .select("status, session:class_sessions(starts_at, gym:gyms(name), class:classes(title))")
      .eq("user_id", userId)
      .eq("status", "booked")
      .limit(20);
    const upcoming = (bookings || [])
      .filter((b) => b.session && new Date(b.session.starts_at).getTime() >= Date.now())
      .map((b) => ({ title: b.session.class?.title, starts_at: b.session.starts_at, centre: b.session.gym?.name }));
    const { data: waits } = await admin
      .from("waitlist_entries")
      .select("position, session:class_sessions(starts_at, class:classes(title))")
      .eq("user_id", userId);
    return {
      bookings: upcoming,
      waitlists: (waits || []).map((w) => ({ title: w.session?.class?.title, starts_at: w.session?.starts_at, position: w.position })),
    };
  },

  async get_recent_workouts(userId) {
    const { data: bookings } = await admin
      .from("bookings")
      .select("status, session:class_sessions(starts_at, class:classes(title, format))")
      .eq("user_id", userId)
      .in("status", ["completed", "booked"])
      .limit(30);
    const past = (bookings || [])
      .filter((b) => b.session && new Date(b.session.starts_at).getTime() < Date.now())
      .sort((a, b) => new Date(b.session.starts_at) - new Date(a.session.starts_at))
      .slice(0, 5)
      .map((b) => ({ title: b.session.class?.title, format: b.session.class?.format, when: b.session.starts_at }));
    const { data: visits } = await admin
      .from("visits")
      .select("check_in_at, duration_min, gym:gyms(name)")
      .eq("user_id", userId)
      .eq("status", "completed")
      .order("check_in_at", { ascending: false })
      .limit(5);
    return {
      recent_classes: past,
      recent_visits: (visits || []).map((v) => ({ centre: v.gym?.name, when: v.check_in_at, duration_min: v.duration_min })),
    };
  },

  async get_visit_summary(userId) {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const { data: visits } = await admin
      .from("visits")
      .select("check_in_at, duration_min, status")
      .eq("user_id", userId)
      .limit(300);
    const all = visits || [];
    const durations = all.filter((v) => v.duration_min).map((v) => v.duration_min);
    return {
      total_visits: all.length,
      visits_this_month: all.filter((v) => v.check_in_at >= monthStart).length,
      avg_duration_min: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null,
    };
  },

  async get_notification_preferences(userId) {
    const { data } = await admin
      .from("notification_preferences")
      .select("workout_reminder, rebooking_confirmed, recovery_reminder, buddy_confirmation")
      .eq("user_id", userId)
      .maybeSingle();
    return data || { workout_reminder: true, rebooking_confirmed: true, recovery_reminder: true, buddy_confirmation: true };
  },

  async search_workout_library(userId, args) {
    const chunks = await retrieve(args?.query || "", userId, { contentTypes: ["workout", "equipment", "class"], limit: 5 });
    return { results: chunks.map((c) => ({ title: c.title, source: c.source, content: c.content })) };
  },

  async search_help_content(userId, args) {
    const chunks = await retrieve(args?.query || "", userId, { contentTypes: ["faq", "policy", "safety"], limit: 5 });
    return { results: chunks.map((c) => ({ title: c.title, source: c.source, content: c.content })) };
  },
};

/** Execute a tool by name with the verified member id. Logs invocation (name only). */
export async function runTool(name, userId, args) {
  const handler = handlers[name];
  if (!handler) return { error: `Unknown tool: ${name}` };
  await logEvent(userId, "ai_tool_invoked", { tool: name });
  try {
    return await handler(userId, args || {});
  } catch (err) {
    console.error(`AI tool ${name} failed`, err);
    return { error: "That information is temporarily unavailable." };
  }
}

export const NOW = nowIso;
