// Typed calls to our backend for centres, plans, membership and onboarding.
import { apiGet, apiSend } from "./api";
import type {
  Gym,
  GymDetail,
  MembershipPlan,
  Membership,
  Invoice,
  ClassSession,
  Booking,
  WaitlistEntry,
  Workout,
  WorkoutExercise,
  WorkoutSession,
  SessionHistoryItem,
  RoutineProgress,
  NutritionProfile,
  NutritionDay,
  NutritionHistoryDay,
  Meal,
  BuddyData,
} from "./models";

export interface BuddyInviteInput {
  email: string;
  relationship?: string;
  share_next_workout: boolean;
  share_support_requests: boolean;
  share_confirmation: boolean;
  consent: boolean;
}

export interface MealLogInput {
  date?: string;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  meal_id?: string;
  name?: string;
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
}

export interface WorkoutFilters {
  goal?: string;
  type?: string;
  difficulty?: string;
  equipment?: string;
  duration_max?: number;
  short?: boolean;
}

export interface ClassFilters {
  gym?: string;
  date?: string;
  format?: string;
  intensity?: string;
  available?: boolean;
}

export interface OnboardingPayload {
  name: string;
  date_of_birth?: string | null;
  phone?: string | null;
  fitness_experience?: string | null;
  primary_goal?: string | null;
  home_gym_id?: string | null;
  plan_id?: string | null;
  preferred_formats?: string[];
  available_days?: string[];
  preferred_time?: string | null;
  workout_duration?: number | null;
  low_energy_periods?: string | null;
  backup_plan_enabled?: boolean;
  ai_mode?: "personalised" | "faq_only" | "disabled";
  ai_retain_history?: boolean;
}

export const data = {
  getGyms: (q?: string) => apiGet<{ gyms: Gym[] }>(`/api/gyms${q ? `?q=${encodeURIComponent(q)}` : ""}`).then((r) => r.gyms),
  getGym: (id: string) => apiGet<GymDetail>(`/api/gyms/${id}`),
  getPlans: () => apiGet<{ plans: MembershipPlan[] }>("/api/plans").then((r) => r.plans),
  getMembership: () => apiGet<{ membership: Membership | null; invoices: Invoice[] }>("/api/membership"),
  submitOnboarding: (payload: OnboardingPayload) => apiSend<{ profile: unknown }>("/api/onboarding", "POST", payload),
  changeHomeGym: (home_gym_id: string) => apiSend("/api/membership", "PATCH", { home_gym_id }),
  freezeMembership: (until?: string) => apiSend("/api/membership/freeze", "POST", { until }),
  unfreezeMembership: () => apiSend("/api/membership/unfreeze", "POST"),
  cancelMembership: () => apiSend("/api/membership/cancel", "POST"),

  // Classes & bookings
  getClasses: (filters: ClassFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.gym) params.set("gym", filters.gym);
    if (filters.date) params.set("date", filters.date);
    if (filters.format) params.set("format", filters.format);
    if (filters.intensity) params.set("intensity", filters.intensity);
    if (filters.available) params.set("available", "true");
    const qs = params.toString();
    return apiGet<{ sessions: ClassSession[] }>(`/api/classes${qs ? `?${qs}` : ""}`).then((r) => r.sessions);
  },
  getBookings: () =>
    apiGet<{ upcoming: Booking[]; past: Booking[]; waitlists: WaitlistEntry[] }>("/api/bookings"),
  bookClass: (sessionId: string) => apiSend<{ ok: boolean }>(`/api/classes/${sessionId}/book`, "POST"),
  cancelBooking: (bookingId: string) => apiSend<{ ok: boolean; promoted: boolean }>(`/api/bookings/${bookingId}/cancel`, "POST"),
  joinWaitlist: (sessionId: string) => apiSend<{ ok: boolean; position: number }>(`/api/classes/${sessionId}/waitlist`, "POST"),
  leaveWaitlist: (sessionId: string) => apiSend(`/api/classes/${sessionId}/waitlist`, "DELETE"),

  // Workouts & guided sessions
  getWorkouts: (filters: WorkoutFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.goal) params.set("goal", filters.goal);
    if (filters.type) params.set("type", filters.type);
    if (filters.difficulty) params.set("difficulty", filters.difficulty);
    if (filters.equipment) params.set("equipment", filters.equipment);
    if (filters.duration_max) params.set("duration_max", String(filters.duration_max));
    if (filters.short) params.set("short", "true");
    const qs = params.toString();
    return apiGet<{ workouts: Workout[] }>(`/api/workouts${qs ? `?${qs}` : ""}`).then((r) => r.workouts);
  },
  getWorkout: (id: string) => apiGet<{ workout: Workout; exercises: WorkoutExercise[] }>(`/api/workouts/${id}`),
  getActiveSession: () => apiGet<{ session: WorkoutSession | null }>("/api/sessions/active").then((r) => r.session),
  getSession: (id: string) => apiGet<{ session: WorkoutSession }>(`/api/sessions/${id}`).then((r) => r.session),
  getWorkoutHistory: () => apiGet<{ sessions: SessionHistoryItem[] }>("/api/sessions/history").then((r) => r.sessions),
  startWorkout: (workoutId: string, scheduledId?: string) =>
    apiSend<{ session: WorkoutSession; resumed?: boolean }>(`/api/workouts/${workoutId}/start`, "POST", { scheduled_id: scheduledId }),
  toggleExercise: (sessionId: string, exerciseId: string, completed: boolean) =>
    apiSend(`/api/sessions/${sessionId}/exercises/${exerciseId}/toggle`, "POST", { completed }),
  completeSession: (sessionId: string, totalSeconds?: number) =>
    apiSend<{ ok: boolean }>(`/api/sessions/${sessionId}/complete`, "POST", { total_duration_sec: totalSeconds }),
  abandonSession: (sessionId: string) => apiSend(`/api/sessions/${sessionId}/abandon`, "POST"),

  // 45-Day Routine
  getRoutine: () => apiGet<RoutineProgress>("/api/routine"),
  startRoutine: (payload: { days_per_week?: number; workout_ids?: string[] } = {}) =>
    apiSend<RoutineProgress>("/api/routine/start", "POST", payload),
  getTiredDayWorkouts: () => apiGet<{ workouts: Workout[] }>("/api/routine/tired-day").then((r) => r.workouts),
  scheduleWorkout: (workout_id: string | null, date: string) => apiSend("/api/routine/schedule", "POST", { workout_id, date }),
  rescheduleWorkout: (scheduledId: string, date: string) => apiSend(`/api/routine/schedule/${scheduledId}/reschedule`, "POST", { date }),
  skipWorkout: (scheduledId: string) => apiSend(`/api/routine/schedule/${scheduledId}/skip`, "POST"),

  // Nutrition
  getNutrition: (date?: string) => apiGet<NutritionDay>(`/api/nutrition${date ? `?date=${date}` : ""}`),
  saveNutritionProfile: (payload: {
    goal: string;
    dietary_preference: string;
    allergies?: string[];
    calorie_target?: number;
  }) => apiSend<{ profile: NutritionProfile }>("/api/nutrition/profile", "POST", payload),
  getMeals: (type?: string) => apiGet<{ meals: Meal[] }>(`/api/nutrition/meals${type ? `?type=${type}` : ""}`).then((r) => r.meals),
  logMeal: (input: MealLogInput) => apiSend<{ entry: unknown }>("/api/nutrition/log", "POST", input),
  deleteMeal: (id: string) => apiSend(`/api/nutrition/log/${id}`, "DELETE"),
  getNutritionHistory: (days = 7) => apiGet<{ history: NutritionHistoryDay[] }>(`/api/nutrition/history?days=${days}`).then((r) => r.history),

  // Trusted buddy
  getBuddy: () => apiGet<BuddyData>("/api/buddy"),
  inviteBuddy: (input: BuddyInviteInput) => apiSend<{ ok: boolean }>("/api/buddy/invite", "POST", input),
  respondBuddy: (id: string, accept: boolean) => apiSend(`/api/buddy/${id}/respond`, "POST", { accept }),
  updateBuddySharing: (id: string, patch: Record<string, boolean>) => apiSend(`/api/buddy/${id}/sharing`, "POST", patch),
  disconnectBuddy: (id: string) => apiSend(`/api/buddy/${id}/disconnect`, "POST"),
  requestBuddySupport: (message?: string) => apiSend<{ ok: boolean }>("/api/buddy/request-support", "POST", { message }),
  confirmBuddySupport: (id: string) => apiSend(`/api/buddy/support/${id}/confirm`, "POST"),

  // Account
  deleteAccount: () => apiSend<{ ok: boolean }>("/api/me/account", "DELETE"),

  // AI Routine Assistant
  aiStatus: () => apiGet<AiStatus>("/api/ai/status"),
  aiConsent: () => apiGet<{ consent: AiConsent }>("/api/ai/consent").then((r) => r.consent),
  updateAiConsent: (patch: Partial<Pick<AiConsent, "mode" | "retain_history">>) => apiSend("/api/ai/consent", "PATCH", patch),
  aiHistory: () => apiGet<{ messages: AiMessage[] }>("/api/ai/history").then((r) => r.messages),
  clearAiHistory: () => apiSend("/api/ai/history", "DELETE"),
  aiChat: (message: string, history: { role: string; content: string }[]) =>
    apiSend<AiChatResponse>("/api/ai/chat", "POST", { message, history }),
  aiFeedback: (messageId: string, value: 1 | -1 | 0) => apiSend("/api/ai/feedback", "POST", { message_id: messageId, value }),
};

export interface AiStatus {
  configured: boolean;
  model: string;
  mode: "personalised" | "faq_only" | "disabled";
  retain_history: boolean;
}
export interface AiConsent {
  mode: "personalised" | "faq_only" | "disabled";
  retain_history: boolean;
  consented_at?: string | null;
  revoked_at?: string | null;
}
export interface AiSource {
  source: string;
  title: string;
}
export interface AiMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  sources?: AiSource[] | null;
  feedback?: number | null;
  created_at?: string;
}
export interface AiChatResponse {
  answer: string;
  sources: AiSource[];
  message_id: string | null;
}
