import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, CalendarPlus, Compass, Dumbbell, Play, ChevronRight, Flame, Apple } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { data } from "@/lib/data";
import type { RoutineProgress, WorkoutSession } from "@/lib/models";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function Home() {
  const { profile } = useAuth();
  const firstName = profile?.name?.split(" ")[0] || "there";
  const [routine, setRoutine] = useState<RoutineProgress | null>(null);
  const [active, setActive] = useState<WorkoutSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [r, a] = await Promise.all([
          data.getRoutine().catch(() => null),
          data.getActiveSession().catch(() => null),
        ]);
        if (!alive) return;
        setRoutine(r);
        setActive(a);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const hasRoutine = routine?.active;
  const pct = hasRoutine && routine?.target ? Math.min(100, Math.round(((routine.completedCount || 0) / routine.target) * 100)) : 0;

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm font-medium text-muted-foreground">{greeting()},</p>
        <h1 className="text-[28px] font-extrabold leading-tight text-navy-700">{firstName}</h1>
      </header>

      {/* Resume an interrupted workout */}
      {active && (
        <Link to={`/session/${active.id}`} className="block">
          <Card className="flex items-center justify-between gap-3 border-teal-200 bg-teal-50/60 p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-white">
                <Play className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-bold text-navy-700">Resume your workout</p>
                <p className="text-xs text-muted-foreground">{active.title}</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-teal-700" />
          </Card>
        </Link>
      )}

      {loading ? (
        <div className="skeleton h-[188px] w-full" />
      ) : hasRoutine ? (
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-br from-navy-700 to-navy-600 p-6 text-white">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-white/80">Week {routine?.weekNumber} · {routine?.daysLeft} days left</p>
              {routine?.needsComeback && (
                <span className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold">
                  <Flame className="h-3.5 w-3.5" /> Comeback
                </span>
              )}
            </div>
            <h2 className="mt-2 text-2xl font-extrabold">
              {routine?.completedCount}<span className="text-lg text-white/70"> / {routine?.target} workouts</span>
            </h2>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-white transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <div className="p-4">
            {routine?.next ? (
              <Button asChild size="lg" className="w-full">
                <Link to="/routine">
                  <Play className="h-5 w-5" />
                  {routine.next.workout?.title ? `Next: ${routine.next.workout.title}` : "Continue my routine"}
                </Link>
              </Button>
            ) : (
              <Button asChild size="lg" className="w-full">
                <Link to="/routine">Open my routine</Link>
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-br from-navy-700 to-navy-600 p-6 text-white">
            <p className="text-sm font-medium text-white/80">Let's get you started</p>
            <h2 className="mt-1 text-xl font-extrabold leading-snug text-white">Build your first 45-day routine</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/80">
              Consistency across weeks matters more than a perfect streak. We'll help you set a realistic plan you can actually keep.
            </p>
          </div>
          <div className="p-4">
            <Button asChild size="lg" className="w-full">
              <Link to="/routine">
                <CalendarPlus className="h-5 w-5" />
                Set up my routine
              </Link>
            </Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Tile to="/workouts" icon={<Dumbbell className="h-6 w-6 text-teal-700" />} title="Start a workout" subtitle="Browse the library" />
        <Tile to="/routine" icon={<CalendarPlus className="h-6 w-6 text-orange-500" />} title="My routine" subtitle="Plan & progress" />
        <Tile to="/nutrition" icon={<Apple className="h-6 w-6 text-magenta-600" />} title="Nutrition" subtitle="Meals & calories" />
        <Tile to="/explore" icon={<Compass className="h-6 w-6 text-navy-700" />} title="Explore" subtitle="Centres & classes" />
        <Tile to="/assistant" icon={<Sparkles className="h-6 w-6 text-purple-600" />} title="Routine Assistant" subtitle="Ask what to do next" />
      </div>
    </div>
  );
}

function Tile({ to, icon, title, subtitle }: { to: string; icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <Link
      to={to}
      className={cn("flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 shadow-card transition hover:shadow-card-hover")}
    >
      {icon}
      <span className="text-sm font-semibold text-navy-700">{title}</span>
      <span className="text-xs text-muted-foreground">{subtitle}</span>
    </Link>
  );
}
