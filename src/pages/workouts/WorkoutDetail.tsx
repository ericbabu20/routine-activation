import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Clock, Dumbbell, Repeat, Timer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LoadingScreen, ErrorScreen } from "@/components/states";
import { data } from "@/lib/data";
import type { Workout, WorkoutExercise } from "@/lib/models";

export default function WorkoutDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setError(null);
      try {
        const r = await data.getWorkout(id);
        if (!alive) return;
        setWorkout(r.workout);
        setExercises(r.exercises);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Couldn't load that workout.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  async function start() {
    setStarting(true);
    try {
      const r = await data.startWorkout(id);
      if (r.resumed) toast.message("Picking up where you left off.");
      navigate(`/session/${r.session.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Couldn't start that workout.";
      if (/in progress/i.test(msg)) {
        // A different session is already running — take the member to it.
        try {
          const active = await data.getActiveSession();
          if (active) {
            toast.message("You already have a workout in progress.");
            navigate(`/session/${active.id}`);
            return;
          }
        } catch {
          /* fall through to error toast */
        }
      }
      toast.error(msg);
    } finally {
      setStarting(false);
    }
  }

  if (error) return <div className="px-5 pt-6"><ErrorScreen message={error} onRetry={() => navigate(0)} /></div>;
  if (!workout) return <LoadingScreen label="Loading workout…" />;

  return (
    <div className="mx-auto min-h-dvh w-full max-w-md bg-background pb-28">
      <header className="flex items-center gap-2 px-5 pt-6">
        <Link to="/workouts" aria-label="Back to workouts" className="rounded-lg p-1 text-navy-700 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <span className="text-sm font-semibold text-muted-foreground">Workout</span>
      </header>

      <div className="px-5 pt-3">
        <h1 className="text-[26px] font-extrabold leading-tight text-navy-700">{workout.title}</h1>
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{workout.duration_min} min</span>
          <span className="capitalize">{workout.workout_type}</span>
          <span className="capitalize">{workout.difficulty}</span>
        </p>
        {workout.description && <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{workout.description}</p>}

        {workout.equipment.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {workout.equipment.map((e) => (
              <span key={e} className="inline-flex items-center gap-1 rounded-full bg-mist px-3 py-1 text-xs font-semibold text-navy-700">
                <Dumbbell className="h-3.5 w-3.5" />{e}
              </span>
            ))}
          </div>
        )}

        <h2 className="mt-6 text-sm font-bold text-navy-700">{exercises.length} exercises</h2>
        <ol className="mt-3 space-y-3">
          {exercises.map((ex, i) => (
            <li key={ex.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-50 text-sm font-bold text-teal-700">{i + 1}</span>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-navy-700">{ex.name}</h3>
                  {ex.instructions && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{ex.instructions}</p>}
                  <p className="mt-2 flex flex-wrap items-center gap-x-3 text-xs font-medium text-muted-foreground">
                    {ex.sets != null && ex.reps != null && <span className="flex items-center gap-1"><Repeat className="h-3.5 w-3.5" />{ex.sets} × {ex.reps}</span>}
                    {ex.duration_sec != null && <span className="flex items-center gap-1"><Timer className="h-3.5 w-3.5" />{ex.duration_sec}s</span>}
                    <span>Rest {ex.rest_sec}s</span>
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-border bg-white/95 p-4 backdrop-blur">
        <Button size="lg" className="w-full" disabled={starting} onClick={start}>
          {starting ? "Starting…" : "Start workout"}
        </Button>
      </div>
    </div>
  );
}
