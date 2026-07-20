// Shared TypeScript types describing the prototype state (mirrors server/seed.js).

export type WorkoutStatus = "completed" | "missed" | "booked" | "upcoming";

export interface Workout {
  id: string;
  week: number;
  day: string;
  time: string;
  format: string;
  duration: number;
  status: WorkoutStatus;
  planB: boolean;
  recovered: boolean;
}

export interface RoutineDay {
  day: string;
  time: string;
}

export interface Routine {
  setupCompleted: boolean;
  goal: string;
  formats: string[];
  perWeek: number;
  days: RoutineDay[];
  lowEnergy: string;
  duration: number;
  planBEnabled: boolean;
  planB: string;
  buddyInvited: boolean;
}

export type BuddyStatus = "none" | "invited" | "connected";

export interface BuddySharing {
  nextWorkout: boolean;
  supportRequest: boolean;
  confirmationStatus: boolean;
}

export interface Buddy {
  invited: boolean;
  name: string;
  relationship: string;
  status: BuddyStatus;
  consent: boolean;
  muted: boolean;
  nextConfirmation: string;
  sharing: BuddySharing;
}

export interface User {
  name: string;
  email: string;
  age: number;
  goal: string;
  membership: string;
  currentDay: number;
  totalDays: number;
}

export interface NotificationPrefs {
  workoutReminder: boolean;
  rebookingConfirmed: boolean;
  recoveryReminder: boolean;
  buddyConfirmation: boolean;
}

export type EventName =
  | "routine_setup_started"
  | "routine_setup_completed"
  | "workout_booked"
  | "workout_completed"
  | "workout_missed"
  | "comeback_card_viewed"
  | "comeback_option_selected"
  | "workout_rebooked"
  | "plan_b_started"
  | "buddy_invite_sent"
  | "buddy_invite_accepted"
  | "buddy_request_sent"
  | "routine_map_viewed"
  | "routine_activated"
  | "buddy_consent_revoked";

export interface AppEvent {
  id: string;
  name: EventName | string;
  detail: string | null;
  ts: string;
}

export interface AppState {
  version: number;
  user: User;
  routine: Routine;
  workouts: Workout[];
  buddy: Buddy;
  mode: "normal" | "tired";
  comeback: { active: boolean; reason: "missed" | "inactivity" | null };
  lastActivityDay: number;
  targets: { workouts: number; activeWeeks: number };
  notifications: NotificationPrefs;
  events: AppEvent[];
  createdAt: string;
}

export interface RebookOption {
  id: string;
  label: string;
  day: string;
  time: string;
  format: string;
  duration: number;
}
