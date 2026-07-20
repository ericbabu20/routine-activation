import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check, Pause, Play, Repeat, Timer, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LoadingScreen, ErrorScreen } from "@/components/states";
import { cn } from "@/lib/utils";
import { data } from "@/lib/data";
import type { WorkoutSession, SessionExercise } from "@/lib/models";

function fmtClock(totalSec: number) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function Session() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [exercises, setExercises] = useState<SessionExercise[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const busyRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    (async () => {
      setError(null);
      try {
        const s = await data.getSession(id);
        if (!alive) return;
        if (s.status !== "in_progress") {
          toast.message("This workout is already finished.");
          navigate("/routine", { replace: true });
          return;
        }
        setSession(s);
        setExercises(s.exercises);
        // Seed the timer from how long ago the session started.
        const started = new Date(s.started_at).getTime();
        setElapsed(Math.max(0, Math.floor((Date.now() - started) / 1000)));
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Couldn't load your workout.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, navigate]);

  useEffect(() => {
    if (!running || !session) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [running, session]);

  async function toggle(ex: SessionExercise) {
    if (busyRef.current.has(ex.id)) return;
    busyRef.current.add(ex.id);
    const next = !ex.completed;
    setExercises((list) => list.map((e) => (e.id === ex.id ? { ...e, completed: next } : e)));
    try {
      await data.toggleExercise(id, ex.id, next);
    } catch (err) {
      setExercises((list) => list.map((e) => (e.id === ex.id ? { ...e, completed: !next } : e)));
      toast.error(err instanceof Error ? err.message : "Couldn't save that.");
    } finally {
      busyRef.current.delete(ex.id);
    }
  }

  async function finish() {
    setFinishing(true);
    try {
      await data.completeSession(id, elapsed);
      toast.success("Workout complete — nice work!");
      navigate("/routine", { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save your workout.");
      setFinishing(false);
    }
  }

  async function abandon() {
    if (!window.confirm("End this workout without saving it?")) return;
    try {
      await data.abandonSession(id);
      navigate("/workouts", { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't end that workout.");
    }
  }

  if (error) return <div className="px-5 pt-6"><ErrorScreen message={error} onRetry={() => navigate(0)} /></div>;
  if (!session) return <LoadingScreen label="Loading your workout…" />;

  const doneCount = exercises.filter((e) => e.completed).length;
  const total = exercises.length;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-white/95 px-5 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <button aria-label="End workout" onClick={abandon} className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-navy-700">
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 text-navy-700">
            <Timer className="h-4 w-4" />
            <span className="font-mono text-lg font-bold tabular-nums" aria-label="Elapsed time">{fmtClock(elapsed)}</span>
          </div>
          <button
            aria-label={running ? "Pause timer" : "Resume timer"}
            onClick={() => setRunning((r) => !r)}
            className="rounded-lg p-1 text-navy-700 hover:bg-muted"
          >
            {running ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </button>
        </div>
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>{session.title}</span>
            <span>{doneCount}/{total} done</span>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-mist">
            <div className="h-full rounded-full bg-teal-600 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </header>

      <main className="flex-1 px-5 py-4">
        <ul className="space-y-3">
          {exercises.map((ex, i) => (
            <li key={ex.id}>
              <button
                onClick={() => toggle(ex)}
                aria-pressed={ex.completed}
                className={cn(
                  "flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition",
                  ex.completed ? "border-teal-200 bg-teal-50/60" : "border-border bg-card shadow-card"
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition",
                    ex.completed ? "border-teal-600 bg-teal-600 text-white" : "border-muted-foreground/40 text-transparent"
                  )}
                >
                  <Check className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <h3 className={cn("text-sm font-bold", ex.completed ? "text-teal-800 line-through" : "text-navy-700")}>
                    {i + 1}. {ex.name}
                  </h3>
                  {ex.instructions && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{ex.instructions}</p>}
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-3 text-xs font-medium text-muted-foreground">
                    {ex.target_sets != null && ex.target_reps != null && (
                      <span className="flex items-center gap-1"><Repeat className="h-3.5 w-3.5" />{ex.target_sets} × {ex.target_reps}</span>
                    )}
                    {ex.target_duration_sec != null && <span className="flex items-center gap-1"><Timer className="h-3.5 w-3.5" />{ex.target_duration_sec}s</span>}
                    <span>Rest {ex.rest_sec}s</span>
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </main>

      <div className="sticky bottom-0 border-t border-border bg-white/95 p-4 backdrop-blur">
        <Button size="lg" className="w-full" disabled={finishing} onClick={finish}>
          {finishing ? "Saving…" : total && doneCount < total ? "Finish workout early" : "Finish workout"}
        </Button>
      </div>
    </div>
  );
}
