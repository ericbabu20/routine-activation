import type { AppState, AppEvent, EventName, RebookOption, Workout } from "./types";
import { nextWorkout, currentWeek, dayIndex } from "./selectors";

export interface OnboardingPrefs {
  goal: string;
  days: string[];
  time: string;
  duration: number;
  formats: string[];
  backupPlanId: string;
  backupPlanLabel: string;
}

let counter = 0;
function makeEvent(name: EventName | string, detail?: string | null): AppEvent {
  counter += 1;
  return {
    id: `evt-${Date.now()}-${counter}`,
    name,
    detail: detail ?? null,
    ts: new Date().toISOString(),
  };
}

export function appendEvent(state: AppState, name: EventName | string, detail?: string | null): AppState {
  return { ...state, events: [...state.events, makeEvent(name, detail)] };
}

function newWorkoutId(state: AppState): string {
  const nums = state.workouts.map((w) => parseInt(w.id.replace(/\D/g, ""), 10) || 0);
  return `w${Math.max(0, ...nums) + 1}`;
}

// Mark the most relevant missed workout as recovered (guilt-free momentum repair).
function markLatestMissedRecovered(workouts: Workout[]): Workout[] {
  const missedIndexes = workouts
    .map((w, i) => ({ w, i }))
    .filter(({ w }) => w.status === "missed" && !w.recovered);
  if (missedIndexes.length === 0) return workouts;
  const target = missedIndexes[missedIndexes.length - 1].i;
  return workouts.map((w, i) => (i === target ? { ...w, recovered: true } : w));
}

/** Complete the workout the member just finished. Updates banked counts naturally. */
export function completeNextWorkout(state: AppState): AppState {
  const next = nextWorkout(state);
  if (!next) return appendEvent(state, "workout_completed", "No upcoming workout to complete");
  const workouts = state.workouts.map((w) =>
    w.id === next.id ? { ...w, status: "completed" as const } : w
  );
  let s: AppState = { ...state, workouts, mode: "normal", lastActivityDay: state.user.currentDay };
  s = appendEvent(s, "workout_completed", `Week ${next.week} · ${next.format}`);
  return s;
}

/** Recovery: rebook a session at one of the suggested times. Does not affect banked counts. */
export function rebookWorkout(state: AppState, option: RebookOption, fromComeback = false): AppState {
  const week = currentWeek(state);
  const booking: Workout = {
    id: newWorkoutId(state),
    week,
    day: option.day,
    time: option.time,
    format: option.format,
    duration: option.duration,
    status: "booked",
    planB: false,
    recovered: true,
  };
  const workouts = markLatestMissedRecovered([...state.workouts, booking]);
  let s: AppState = {
    ...state,
    workouts,
    comeback: { active: false, reason: null },
  };
  if (fromComeback) s = appendEvent(s, "comeback_option_selected", "rebook");
  s = appendEvent(s, "workout_rebooked", `${option.day} at ${option.time}`);
  s = appendEvent(s, "workout_booked", `${option.day} at ${option.time}`);
  return s;
}

/** Comeback: "Adjust this week" — let the missed session go gracefully. Banked counts are untouched. */
export function acknowledgeMiss(state: AppState): AppState {
  const workouts = markLatestMissedRecovered(state.workouts);
  let s: AppState = { ...state, workouts, comeback: { active: false, reason: null } };
  s = appendEvent(s, "comeback_option_selected", "adjust_week");
  return s;
}

/** Recovery: a short Plan B / reset session. Protects momentum; not counted as an eligible workout. */
export function startPlanB(state: AppState, label: string, fromComeback = false): AppState {
  let workouts = state.workouts;
  if (fromComeback) workouts = markLatestMissedRecovered(workouts);
  let s: AppState = {
    ...state,
    workouts,
    mode: "normal",
    lastActivityDay: state.user.currentDay,
    comeback: fromComeback ? { active: false, reason: null } : state.comeback,
  };
  if (fromComeback) s = appendEvent(s, "comeback_option_selected", "reset_workout");
  s = appendEvent(s, "plan_b_started", label);
  return s;
}

/** Recovery: ask the buddy to support the next session. Works only if a buddy is connected. */
export function askBuddySupport(state: AppState, fromComeback = false): AppState {
  let s: AppState = {
    ...state,
    comeback: fromComeback ? { active: false, reason: null } : state.comeback,
  };
  if (fromComeback) s = appendEvent(s, "comeback_option_selected", "buddy_support");
  s = appendEvent(s, "buddy_request_sent", state.buddy.name || "Buddy");
  return s;
}

/** Tired-Day: swap the next session for a lighter, shorter Plan B session (stays booked). */
export function switchToLighterWorkout(state: AppState): AppState {
  const next = nextWorkout(state);
  if (!next) return appendEvent(state, "plan_b_started", "20-minute lighter session");
  const workouts = state.workouts.map((w) =>
    w.id === next.id
      ? { ...w, planB: true, duration: 20, format: `Light ${w.format.toLowerCase()}` }
      : w
  );
  let s: AppState = { ...state, workouts, mode: "normal" };
  s = appendEvent(s, "plan_b_started", "20-minute lighter session");
  return s;
}

/** Tired-Day: keep the original session as planned. */
export function continueOriginalWorkout(state: AppState): AppState {
  return { ...state, mode: "normal" };
}

export function setTired(state: AppState, tired: boolean): AppState {
  return { ...state, mode: tired ? "tired" : "normal" };
}

/** Tired-Day / Comeback: move the current workout to a new suggested slot. */
export function moveWorkout(state: AppState, option: RebookOption): AppState {
  return rebookWorkout(state, option, false);
}

/* ---------- Notifications ---------- */

export function setNotification(
  state: AppState,
  key: keyof AppState["notifications"],
  value: boolean
): AppState {
  return { ...state, notifications: { ...state.notifications, [key]: value } };
}

/* ---------- Buddy actions ---------- */

export function inviteBuddy(
  state: AppState,
  info: { name: string; relationship: string; sharing: AppState["buddy"]["sharing"] }
): AppState {
  let s: AppState = {
    ...state,
    routine: { ...state.routine, buddyInvited: true },
    buddy: {
      ...state.buddy,
      invited: true,
      name: info.name,
      relationship: info.relationship,
      status: "invited",
      consent: true,
      muted: false,
      sharing: info.sharing,
    },
  };
  s = appendEvent(s, "buddy_invite_sent", info.name);
  return s;
}

/** Mock acceptance to demonstrate the connected state. */
export function acceptBuddy(state: AppState): AppState {
  let s: AppState = { ...state, buddy: { ...state.buddy, status: "connected" } };
  s = appendEvent(s, "buddy_invite_accepted", state.buddy.name);
  return s;
}

export function connectBuddy(state: AppState): AppState {
  const wasConnected = state.buddy.status === "connected";
  let s: AppState = {
    ...state,
    buddy: {
      ...state.buddy,
      invited: true,
      status: "connected",
      consent: true,
      name: state.buddy.name || "Arjun",
      relationship: state.buddy.relationship || "Friend",
    },
  };
  if (!wasConnected) {
    s = appendEvent(s, "buddy_invite_sent", s.buddy.name);
    s = appendEvent(s, "buddy_invite_accepted", s.buddy.name);
  }
  return s;
}

export function disconnectBuddy(state: AppState): AppState {
  return {
    ...state,
    buddy: { ...state.buddy, status: "none", invited: false, consent: false },
  };
}

export function revokeBuddyConsent(state: AppState): AppState {
  let s: AppState = {
    ...state,
    buddy: {
      ...state.buddy,
      consent: false,
      status: "none",
      invited: false,
      sharing: { nextWorkout: false, supportRequest: false, confirmationStatus: false },
    },
  };
  s = appendEvent(s, "buddy_consent_revoked", state.buddy.name);
  return s;
}

export function setBuddyMuted(state: AppState, muted: boolean): AppState {
  return { ...state, buddy: { ...state.buddy, muted } };
}

export function setBuddySharing(
  state: AppState,
  sharing: Partial<AppState["buddy"]["sharing"]>
): AppState {
  return { ...state, buddy: { ...state.buddy, sharing: { ...state.buddy.sharing, ...sharing } } };
}

/* ---------- Routine setup ---------- */

export function startRoutineSetup(state: AppState): AppState {
  return appendEvent(state, "routine_setup_started");
}

export function completeRoutineSetup(state: AppState, routine: Partial<AppState["routine"]>): AppState {
  let s: AppState = { ...state, routine: { ...state.routine, ...routine, setupCompleted: true } };
  s = appendEvent(s, "routine_setup_completed", `${s.routine.perWeek} workouts/week`);
  s = appendEvent(s, "routine_activated", "45-day routine");
  return s;
}

export function logRoutineMapViewed(state: AppState): AppState {
  return appendEvent(state, "routine_map_viewed");
}

/**
 * Build a brand-new 45-day routine from the onboarding answers.
 * Generates upcoming sessions across the plan so the member immediately
 * has a real "next workout". Progress starts at zero for a fresh start.
 */
export function createRoutineFromOnboarding(state: AppState, prefs: OnboardingPrefs): AppState {
  const days = [...prefs.days].sort((a, b) => dayIndex(a) - dayIndex(b));
  const formats = prefs.formats.length ? prefs.formats : ["Strength"];
  const totalWeeks = Math.ceil(state.user.totalDays / 7);

  const workouts: Workout[] = [];
  let idNum = 0;
  let fmtIdx = 0;
  for (let week = 1; week <= totalWeeks; week++) {
    for (const day of days) {
      idNum += 1;
      workouts.push({
        id: `w${idNum}`,
        week,
        day,
        time: prefs.time,
        format: formats[fmtIdx % formats.length],
        duration: prefs.duration,
        status: week === 1 ? "booked" : "upcoming",
        planB: false,
        recovered: false,
      });
      fmtIdx += 1;
    }
  }

  let s: AppState = {
    ...state,
    user: { ...state.user, goal: prefs.goal, currentDay: 1 },
    routine: {
      ...state.routine,
      setupCompleted: true,
      goal: prefs.goal,
      formats,
      perWeek: days.length,
      days: days.map((d) => ({ day: d, time: prefs.time })),
      duration: prefs.duration,
      planBEnabled: prefs.backupPlanId !== "decide",
      planB: prefs.backupPlanLabel,
      buddyInvited: false,
    },
    workouts,
    // A fresh routine starts without a buddy — it's optional and added from Profile.
    buddy: {
      invited: false,
      name: "",
      relationship: "",
      status: "none",
      consent: false,
      muted: false,
      nextConfirmation: "",
      sharing: { nextWorkout: false, supportRequest: false, confirmationStatus: false },
    },
    mode: "normal",
    comeback: { active: false, reason: null },
    lastActivityDay: 1,
  };
  s = appendEvent(s, "routine_setup_completed", `${days.length} workouts/week`);
  s = appendEvent(s, "routine_activated", "45-day routine");
  return s;
}
