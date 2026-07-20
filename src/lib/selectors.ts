import type { AppState, Workout } from "./types";

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function dayIndex(day: string): number {
  const i = DAY_ORDER.indexOf(day);
  return i === -1 ? 99 : i;
}

// Parse "7:00 PM" -> minutes since midnight, for stable ordering.
export function timeToMinutes(time: string): number {
  const m = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return 0;
  let h = parseInt(m[1], 10) % 12;
  if (/pm/i.test(m[3])) h += 12;
  return h * 60 + parseInt(m[2], 10);
}

export function sortWorkouts(a: Workout, b: Workout): number {
  if (a.week !== b.week) return a.week - b.week;
  if (dayIndex(a.day) !== dayIndex(b.day)) return dayIndex(a.day) - dayIndex(b.day);
  return timeToMinutes(a.time) - timeToMinutes(b.time);
}

export function completedWorkouts(state: AppState): Workout[] {
  return state.workouts.filter((w) => w.status === "completed");
}

export function workoutsCompletedCount(state: AppState): number {
  return completedWorkouts(state).length;
}

export function activeWeeks(state: AppState): number[] {
  const weeks = new Set<number>();
  completedWorkouts(state).forEach((w) => weeks.add(w.week));
  return [...weeks].sort((a, b) => a - b);
}

export function activeWeeksCount(state: AppState): number {
  return activeWeeks(state).length;
}

export function remainingWorkouts(state: AppState): number {
  return Math.max(0, state.targets.workouts - workoutsCompletedCount(state));
}

export function remainingActiveWeeks(state: AppState): number {
  return Math.max(0, state.targets.activeWeeks - activeWeeksCount(state));
}

export function recoveredWeeks(state: AppState): number[] {
  const weeks = new Set<number>();
  state.workouts.filter((w) => w.recovered).forEach((w) => weeks.add(w.week));
  return [...weeks].sort((a, b) => a - b);
}

export function recoveredCount(state: AppState): number {
  return state.workouts.filter((w) => w.recovered).length;
}

export function planBCount(state: AppState): number {
  return state.workouts.filter((w) => w.planB && w.status === "completed").length;
}

// The next actionable workout: earliest booked, else earliest upcoming.
export function nextWorkout(state: AppState): Workout | null {
  const booked = state.workouts.filter((w) => w.status === "booked").sort(sortWorkouts);
  if (booked.length) return booked[0];
  const upcoming = state.workouts.filter((w) => w.status === "upcoming").sort(sortWorkouts);
  return upcoming.length ? upcoming[0] : null;
}

export interface WeekSummary {
  week: number;
  completed: number;
  missed: number;
  hasUpcoming: number; // booked or upcoming count
  recovered: boolean;
  isActive: boolean;
}

export function weekSummaries(state: AppState, maxWeeks = 6): WeekSummary[] {
  const weeksPresent = state.workouts.map((w) => w.week);
  const highest = Math.max(maxWeeks, ...(weeksPresent.length ? weeksPresent : [maxWeeks]));
  const out: WeekSummary[] = [];
  for (let week = 1; week <= highest; week++) {
    const ws = state.workouts.filter((w) => w.week === week);
    const completed = ws.filter((w) => w.status === "completed").length;
    out.push({
      week,
      completed,
      missed: ws.filter((w) => w.status === "missed").length,
      hasUpcoming: ws.filter((w) => w.status === "booked" || w.status === "upcoming").length,
      recovered: ws.some((w) => w.recovered),
      isActive: completed > 0,
    });
  }
  return out;
}

export function currentWeek(state: AppState): number {
  return Math.min(Math.ceil(state.user.currentDay / 7), Math.ceil(state.user.totalDays / 7));
}

// The most relevant workout that was missed and not yet recovered → drives Comeback Mode.
export function pendingMiss(state: AppState): Workout | null {
  const missed = state.workouts
    .filter((w) => w.status === "missed" && !w.recovered)
    .sort(sortWorkouts);
  return missed.length ? missed[missed.length - 1] : null;
}

// Most recently completed sessions (latest first).
export function recentWorkouts(state: AppState, limit = 4): Workout[] {
  return completedWorkouts(state)
    .slice()
    .sort((a, b) => sortWorkouts(b, a))
    .slice(0, limit);
}

export function recoveredWorkouts(state: AppState): Workout[] {
  return state.workouts.filter((w) => w.recovered).sort(sortWorkouts);
}

export function planBWorkouts(state: AppState): Workout[] {
  return state.workouts.filter((w) => w.planB).sort(sortWorkouts);
}

// A short, supportive, human next milestone.
export function nextMilestone(state: AppState): string {
  const workoutsLeft = remainingWorkouts(state);
  const weeksLeft = remainingActiveWeeks(state);
  if (workoutsLeft === 0 && weeksLeft === 0) return "You’ve built your routine — keep it going!";
  if (weeksLeft > 0 && workoutsLeft <= weeksLeft) {
    return `Stay active in ${weeksLeft} more week${weeksLeft > 1 ? "s" : ""} to reach your goal.`;
  }
  return `${workoutsLeft} more workout${workoutsLeft > 1 ? "s" : ""} to reach your goal.`;
}
