import type { RebookOption } from "./types";

// Suggested alternative times, derived from Maya's usual schedule.
export const REBOOK_OPTIONS: RebookOption[] = [
  { id: "opt1", label: "Tomorrow", day: "Wednesday", time: "7:00 PM", format: "Strength", duration: 45 },
  { id: "opt2", label: "Thursday", day: "Thursday", time: "7:00 AM", format: "HIIT", duration: 30 },
  { id: "opt3", label: "Saturday", day: "Saturday", time: "10:00 AM", format: "Yoga", duration: 45 },
];

export const GOAL_OPTIONS = [
  "Build strength",
  "Improve general health",
  "Lose weight",
  "Reduce stress",
  "Build consistency",
  "Improve fitness",
];

export const BACKUP_PLAN_OPTIONS = [
  { id: "shorter", label: "A shorter workout", hint: "Swap in a 20-minute session" },
  { id: "home", label: "A home workout", hint: "No gym needed" },
  { id: "auto", label: "Reschedule automatically", hint: "We’ll suggest a new time" },
  { id: "decide", label: "Decide when it happens", hint: "You choose in the moment" },
];

export const FORMAT_OPTIONS = ["Strength", "Yoga", "HIIT", "Dance", "Cycling", "Mobility"];

export const DAY_OPTIONS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export const TIME_OPTIONS = [
  "6:00 AM",
  "7:00 AM",
  "8:00 AM",
  "12:00 PM",
  "5:00 PM",
  "6:00 PM",
  "7:00 PM",
  "8:00 PM",
];

export const PER_WEEK_OPTIONS = [2, 3, 4, 5];

export const DURATION_OPTIONS = [20, 30, 45, 60];

export const LOW_ENERGY_OPTIONS = [
  "Weekday evenings",
  "Weekday mornings",
  "Weekends",
  "Mid-week (Wednesday slump)",
  "No consistent pattern",
];

export const RELATIONSHIP_OPTIONS = ["Friend", "Family member", "Partner", "Colleague", "Trainer"];
