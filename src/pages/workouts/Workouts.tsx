import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Dumbbell, Clock, Zap } from "lucide-react";
import { toast } from "sonner";
import { PageIntro, EmptyState } from "@/components/PageIntro";
import { cn } from "@/lib/utils";
import { data } from "@/lib/data";
import type { Workout } from "@/lib/models";

const TYPES = [
  { id: "strength", label: "Strength" },
  { id: "cardio", label: "Cardio" },
  { id: "hiit", label: "HIIT" },
  { id: "mobility", label: "Mobility" },
  { id: "yoga", label: "Yoga" },
  { id: "recovery", label: "Recovery" },
];
const LEVELS = [
  { id: "beginner", label: "Beginner" },
  { id: "intermediate", label: "Intermediate" },
  { id: "advanced", label: "Advanced" },
];

const DIFFICULTY_STYLES: Record<string, string> = {
  beginner: "bg-teal-50 text-teal-700",
  intermediate: "bg-amber-50 text-amber-700",
  advanced: "bg-red-50 text-red-700",
};

export default function Workouts() {
  const [searchParams] = useSearchParams();
  const [type, setType] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [short, setShort] = useState(searchParams.get("short") === "1");
  const [workouts, setWorkouts] = useState<Workout[] | null>(null);

  const load = useCallback(async () => {
    setWorkouts(null);
    try {
      const w = await data.getWorkouts({ type, difficulty, short });
      setWorkouts(w);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't load workouts.");
      setWorkouts([]);
    }
  }, [type, difficulty, short]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageIntro title="Workouts" subtitle="Pick a session that fits your energy today." />

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        <Chip active={type === ""} onClick={() => setType("")}>All types</Chip>
        {TYPES.map((t) => (
          <Chip key={t.id} active={type === t.id} onClick={() => setType(type === t.id ? "" : t.id)}>{t.label}</Chip>
        ))}
      </div>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {LEVELS.map((l) => (
          <Chip key={l.id} active={difficulty === l.id} onClick={() => setDifficulty(difficulty === l.id ? "" : l.id)}>{l.label}</Chip>
        ))}
        <Chip active={short} onClick={() => setShort((s) => !s)}>Short & easy</Chip>
      </div>

      {workouts === null ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-[92px] w-full" />)}</div>
      ) : workouts.length === 0 ? (
        <EmptyState icon={<Dumbbell className="h-6 w-6" />} title="No workouts match" body="Try a different type or difficulty." />
      ) : (
        <ul className="space-y-3">
          {workouts.map((w) => (
            <li key={w.id}>
              <Link
                to={`/workouts/${w.id}`}
                className="block rounded-2xl border border-border bg-card p-4 shadow-card transition hover:shadow-card-hover"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-bold text-navy-700">{w.title}</h3>
                      {w.is_short && <Zap className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-label="Short workout" />}
                    </div>
                    {w.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{w.description}</p>}
                    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{w.duration_min} min</span>
                      <span className="capitalize">{w.workout_type}</span>
                    </p>
                  </div>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize", DIFFICULTY_STYLES[w.difficulty])}>
                    {w.difficulty}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "min-h-[36px] shrink-0 whitespace-nowrap rounded-full border px-4 text-sm font-semibold transition",
        active ? "border-teal-600 bg-teal-600 text-white" : "border-border bg-card text-muted-foreground"
      )}
    >
      {children}
    </button>
  );
}
