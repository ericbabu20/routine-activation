// Shared domain types for the Routine Activation app (server-backed).

export interface Gym {
  id: string;
  name: string;
  city: string;
  postcode: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  accessibility: string | null;
}

export interface GymHours {
  day_of_week: number; // 0 = Sunday
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
}

export interface GymDetail {
  gym: Gym;
  hours: GymHours[];
  amenities: string[];
}

export interface MembershipPlan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price_pence: number;
  billing_period: string;
  includes_all_centres: boolean;
  includes_classes: boolean;
  sort_order?: number;
}

export interface Membership {
  id: string;
  status: "active" | "frozen" | "cancelled" | "pending";
  started_at: string;
  next_billing_at: string | null;
  frozen_until: string | null;
  cancelled_at: string | null;
  home_gym_id: string | null;
  plan: MembershipPlan | null;
  home_gym: { id: string; name: string; city: string } | null;
}

export interface Invoice {
  id: string;
  amount_pence: number;
  status: string;
  description: string | null;
  created_at: string;
}

export interface ClassInfo {
  id: string;
  title: string;
  description: string | null;
  format: string;
  intensity: "low" | "moderate" | "high";
  duration_min: number;
  trainer: string | null;
}

export interface ClassSession {
  id: string;
  gym: { id: string; name: string; city: string } | null;
  starts_at: string;
  ends_at: string;
  capacity: number;
  spotsLeft: number;
  isFull: boolean;
  class: ClassInfo;
  myBookingId: string | null;
  myWaitlistPosition: number | null;
}

export interface Booking {
  id: string;
  status: string;
  created_at: string;
  session: {
    id: string;
    starts_at: string;
    ends_at: string;
    gym: { name: string; city: string } | null;
    class: { title: string; format: string; intensity?: string; trainer: string | null } | null;
  } | null;
}

export interface WaitlistEntry {
  position: number;
  session: Booking["session"];
}

export interface Workout {
  id: string;
  title: string;
  description: string | null;
  goal: string | null;
  workout_type: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  duration_min: number;
  equipment: string[];
  is_short: boolean;
}

export interface WorkoutExercise {
  id: string;
  position: number;
  name: string;
  instructions: string | null;
  sets: number | null;
  reps: number | null;
  duration_sec: number | null;
  rest_sec: number;
}

export interface SessionExercise {
  id: string;
  position: number;
  name: string;
  instructions: string | null;
  target_sets: number | null;
  target_reps: number | null;
  target_duration_sec: number | null;
  rest_sec: number;
  completed: boolean;
}

export interface WorkoutSession {
  id: string;
  workout_id: string | null;
  title: string;
  status: "in_progress" | "completed" | "abandoned";
  started_at: string;
  completed_at: string | null;
  total_duration_sec: number | null;
  exercises: SessionExercise[];
}

export interface SessionHistoryItem {
  id: string;
  title: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  total_duration_sec: number | null;
  workout: { workout_type: string; difficulty: string } | null;
}

export interface ScheduledWorkout {
  id: string;
  scheduled_date: string;
  status: "planned" | "completed" | "skipped" | "rescheduled";
  workout_id: string | null;
  session_id: string | null;
  workout: { id: string; title: string; workout_type: string; duration_min: number; difficulty: string } | null;
}

export interface RoutineWeek {
  week: number;
  planned: number;
  completed: number;
  skipped: number;
  items: ScheduledWorkout[];
}

export interface RoutineProgress {
  active: boolean;
  routine?: {
    id: string;
    title: string;
    status: string;
    target_workouts: number;
    window_days: number;
    days_per_week: number;
    started_at: string;
    ends_at: string;
  };
  completedCount?: number;
  target?: number;
  remainingToTarget?: number;
  targetMet?: boolean;
  daysElapsed?: number;
  daysLeft?: number;
  weekNumber?: number;
  onTrack?: boolean;
  expectedByNow?: number;
  plannedRemaining?: number;
  skipped?: number;
  missed?: number;
  next?: ScheduledWorkout | null;
  lastCompletedAt?: string | null;
  daysSinceLast?: number | null;
  needsComeback?: boolean;
  weeklyPlan?: RoutineWeek[];
}

export interface NutritionProfile {
  user_id: string;
  goal: "lose_weight" | "maintain" | "general" | "gain_muscle";
  dietary_preference: "no_preference" | "vegetarian" | "vegan" | "eggetarian" | "non_veg";
  allergies: string[];
  calorie_target: number;
  protein_target_g: number;
  carbs_target_g: number;
  fat_target_g: number;
}

export interface Meal {
  id: string;
  name: string;
  description: string | null;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  diet: "vegan" | "vegetarian" | "non_veg";
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  high_protein: boolean;
}

export interface MealEntry {
  id: string;
  meal_type: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface MacroTotals {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface NutritionDay {
  date: string;
  profile: NutritionProfile | null;
  targets: MacroTotals | null;
  entries: MealEntry[];
  totals: MacroTotals;
  remaining: MacroTotals | null;
  plan: Meal[];
  workedOutToday: boolean;
  disclaimer: string;
}

export interface NutritionHistoryDay extends MacroTotals {
  date: string;
}

export interface BuddyConnection {
  id: string;
  buddyEmail: string;
  buddyName: string | null;
  relationship: string | null;
  status: "pending" | "active" | "declined" | "revoked";
  muted: boolean;
  share_next_workout: boolean;
  share_support_requests: boolean;
  share_confirmation: boolean;
}

export interface BuddySupportRequest {
  id: string;
  workout_title: string | null;
  workout_date: string | null;
  message: string | null;
  status: "sent" | "confirmed";
  created_at: string;
  confirmed_at: string | null;
}

export interface BuddySupporting {
  id: string;
  ownerName: string | null;
  relationship: string | null;
  status: "pending" | "active";
  sharedNextWorkout: { title: string; date: string } | null;
  supportRequests: BuddySupportRequest[];
}

export interface BuddyData {
  connection: BuddyConnection | null;
  supporting: BuddySupporting[];
}

export const NUTRITION_GOALS = [
  { id: "lose_weight", label: "Lose weight" },
  { id: "maintain", label: "Maintain" },
  { id: "gain_muscle", label: "Build muscle" },
  { id: "general", label: "General health" },
] as const;

export const DIETARY_PREFERENCES = [
  { id: "no_preference", label: "No preference" },
  { id: "vegetarian", label: "Vegetarian" },
  { id: "vegan", label: "Vegan" },
  { id: "eggetarian", label: "Eggetarian" },
  { id: "non_veg", label: "Non-veg" },
] as const;

export const GOALS = [
  { id: "build_strength", label: "Build strength" },
  { id: "improve_health", label: "Improve health" },
  { id: "lose_weight", label: "Lose weight" },
  { id: "reduce_stress", label: "Reduce stress" },
  { id: "build_consistency", label: "Build consistency" },
  { id: "improve_general_fitness", label: "Improve general fitness" },
] as const;

export const EXPERIENCE_LEVELS = [
  { id: "beginner", label: "New to fitness" },
  { id: "returning", label: "Getting back into it" },
  { id: "intermediate", label: "Fairly regular" },
  { id: "advanced", label: "Very experienced" },
] as const;

export const WORKOUT_FORMATS = ["Strength", "Cardio", "HIIT", "Yoga", "Mobility", "Dance", "Recovery"] as const;
export const WEEK_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

export function formatPrice(pence: number, currency = "₹"): string {
  return `${currency}${(pence / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}
