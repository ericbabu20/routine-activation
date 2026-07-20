import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarClock, Check, ChevronRight, Flame, Play, RotateCcw, SkipForward, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageIntro } from "@/components/PageIntro";
import { LoadingScreen, ErrorScreen } from "@/components/states";
import { cn } from "@/lib/utils";
import { data } from "@/lib/data";
import type { RoutineProgress, ScheduledWorkout } from "@/lib/models";

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dayLabel(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export default function Routine() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState<RoutineProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [starting, setStarting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      setProgress(await data.getRoutine());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your routine.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function startRoutine() {
    setStarting(true);
    try {
      const p = await data.startRoutine({ days_per_week: daysPerWeek });
      setProgress(p);
      toast.success("Your 45-day routine is live. One session at a time.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't start your routine.");
    } finally {
      setStarting(false);
    }
  }

  async function startScheduled(s: ScheduledWorkout) {
    if (!s.workout_id) {
      navigate("/workouts");
      return;
    }
    setBusyId(s.id);
    try {
      const r = await data.startWorkout(s.workout_id, s.id);
      navigate(`/session/${r.session.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Couldn't start that workout.";
      if (/in progress/i.test(msg)) {
        const active = await data.getActiveSession().catch(() => null);
        if (active) {
          navigate(`/session/${active.id}`);
          return;
        }
      }
      toast.error(msg);
    } finally {
      setBusyId(null);
    }
  }

  async function reschedule(s: ScheduledWorkout) {
    if (!editDate) return;
    setBusyId(s.id);
    try {
      await data.rescheduleWorkout(s.id, editDate);
      setEditing(null);
      await load();
      toast.success("Moved. Flexibility beats perfection.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't reschedule that.");
    } finally {
      setBusyId(null);
    }
  }

  async function skip(s: ScheduledWorkout) {
    setBusyId(s.id);
    try {
      await data.skipWorkout(s.id);
      await load();
      toast.message("Skipped — your progress stays exactly where it was.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update that.");
    } finally {
      setBusyId(null);
    }
  }

  if (error) return <div><PageIntro title="Your routine" /><ErrorScreen message={error} onRetry={load} /></div>;
  if (!progress) return <LoadingScreen label="Loading your routine…" />;

  // ---- Not started yet: activation screen ----------------------------------
  if (!progress.active) {
    return (
      <div className="space-y-5">
        <PageIntro title="45-Day Activation" subtitle="A flexible plan to make the gym a habit — not a streak to protect." />
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-br from-navy-700 to-navy-600 p-6 text-white">
            <Sparkles className="h-6 w-6 text-white/90" />
            <h2 className="mt-3 text-xl font-extrabold leading-snug">Aim for 8 workouts in your first 4 weeks</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/80">
              We'll spread sessions across your preferred days. Miss one? Nothing resets — we just help you pick up the next achievable step.
            </p>
          </div>
          <div className="space-y-4 p-5">
            <div>
              <p className="text-sm font-semibold text-navy-700">How many days a week feels realistic?</p>
              <div className="mt-2 flex gap-2">
                {[2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setDaysPerWeek(n)}
                    className={cn(
                      "min-h-[44px] flex-1 rounded-xl border text-sm font-semibold transition",
                      daysPerWeek === n ? "border-teal-600 bg-teal-600 text-white" : "border-border bg-card text-navy-700"
                    )}
                  >
                    {n} days
                  </button>
                ))}
              </div>
            </div>
            <Button size="lg" className="w-full" disabled={starting} onClick={startRoutine}>
              {starting ? "Setting up…" : "Start my 45-day routine"}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // ---- Active routine ------------------------------------------------------
  const p = progress;
  const pct = p.target ? Math.min(100, Math.round(((p.completedCount || 0) / p.target) * 100)) : 0;

  return (
    <div className="space-y-5">
      <PageIntro title="Your routine" subtitle={`Week ${p.weekNumber} · ${p.daysLeft} days left in your window`} />

      {/* Progress */}
      <Card className="p-5">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Workouts completed</p>
            <p className="mt-1 text-3xl font-extrabold text-navy-700">
              {p.completedCount}<span className="text-lg text-muted-foreground"> / {p.target}</span>
            </p>
          </div>
          <span
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold",
              p.targetMet ? "bg-teal-50 text-teal-700" : p.onTrack ? "bg-teal-50 text-teal-700" : "bg-amber-50 text-amber-700"
            )}
          >
            {p.targetMet ? "Goal reached" : p.onTrack ? "On track" : "Let's build momentum"}
          </span>
        </div>
        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-mist">
          <div className="h-full rounded-full bg-teal-600 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {p.targetMet
            ? "You've hit your activation goal. Keep going at a pace that feels good."
            : `${p.remainingToTarget} to go. Small, repeatable sessions beat one big push.`}
        </p>
      </Card>

      {/* Comeback Mode */}
      {p.needsComeback && (
        <Card className="border-amber-200 bg-amber-50/60 p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <Flame className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-navy-700">Welcome back — let's restart gently</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                A short, easy session is the best way back in. No need to make up for lost time.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => navigate("/workouts?short=1")}>
                  Find a shorter workout
                </Button>
                <Button variant="ghost" onClick={() => navigate("/buddy")}>
                  Ask my buddy
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Next up */}
      {p.next ? (
        <section>
          <h2 className="mb-2 text-sm font-bold text-navy-700">Next up</h2>
          <Card className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-teal-700">{dayLabel(p.next.scheduled_date)}</p>
                <h3 className="mt-0.5 truncate text-sm font-bold text-navy-700">
                  {p.next.workout?.title || "Choose a workout"}
                </h3>
                {p.next.workout && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {p.next.workout.duration_min} min · {p.next.workout.workout_type}
                  </p>
                )}
              </div>
              <Button disabled={busyId === p.next.id} onClick={() => startScheduled(p.next!)}>
                <Play className="h-4 w-4" />{busyId === p.next.id ? "…" : "Start"}
              </Button>
            </div>
          </Card>
        </section>
      ) : (
        <Button variant="outline" size="lg" className="w-full" onClick={() => navigate("/workouts")}>
          Browse workouts <ChevronRight className="h-4 w-4" />
        </Button>
      )}

      {/* Tired-day */}
      <button
        onClick={() => navigate("/workouts?short=1")}
        className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-4 text-left shadow-card"
      >
        <div>
          <p className="text-sm font-bold text-navy-700">Feeling tired?</p>
          <p className="text-xs text-muted-foreground">Swap in a shorter, gentler session.</p>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </button>

      {/* Weekly plan */}
      <section>
        <h2 className="mb-2 text-sm font-bold text-navy-700">Weekly plan</h2>
        <div className="space-y-4">
          {(p.weeklyPlan || []).map((wk) => (
            <div key={wk.week}>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Week {wk.week}</p>
                <p className="text-xs text-muted-foreground">{wk.completed}/{wk.items.length} done</p>
              </div>
              <ul className="space-y-2">
                {wk.items.map((s) => (
                  <li key={s.id} className="rounded-xl border border-border bg-card p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-muted-foreground">{dayLabel(s.scheduled_date)}</p>
                        <p className="truncate text-sm font-semibold text-navy-700">{s.workout?.title || "Workout"}</p>
                      </div>
                      <StatusBadge status={s.status} />
                    </div>

                    {s.status === "planned" && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button size="sm" variant="secondary" disabled={busyId === s.id} onClick={() => startScheduled(s)}>
                          <Play className="h-3.5 w-3.5" />Start
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setEditing(editing === s.id ? null : s.id); setEditDate(isoDate(new Date())); }}>
                          <RotateCcw className="h-3.5 w-3.5" />Reschedule
                        </Button>
                        <Button size="sm" variant="ghost" disabled={busyId === s.id} onClick={() => skip(s)}>
                          <SkipForward className="h-3.5 w-3.5" />Skip
                        </Button>
                      </div>
                    )}

                    {editing === s.id && (
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="date"
                          value={editDate}
                          min={isoDate(new Date())}
                          onChange={(e) => setEditDate(e.target.value)}
                          className="min-h-[40px] flex-1 rounded-lg border border-input bg-white px-3 text-sm text-navy-700"
                        />
                        <Button size="sm" disabled={busyId === s.id} onClick={() => reschedule(s)}>Move</Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "completed")
    return <span className="flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700"><Check className="h-3.5 w-3.5" />Done</span>;
  if (status === "skipped")
    return <span className="rounded-full bg-mist px-2.5 py-1 text-xs font-semibold text-muted-foreground">Skipped</span>;
  return <span className="flex items-center gap-1 rounded-full bg-navy-50 px-2.5 py-1 text-xs font-semibold text-navy-700"><CalendarClock className="h-3.5 w-3.5" />Planned</span>;
}
