import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Utensils, Info, Flame, RefreshCw, X, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageIntro } from "@/components/PageIntro";
import { LoadingScreen, ErrorScreen } from "@/components/states";
import { cn } from "@/lib/utils";
import { data } from "@/lib/data";
import { NUTRITION_GOALS, DIETARY_PREFERENCES } from "@/lib/models";
import type { NutritionDay, Meal } from "@/lib/models";

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
type MealType = (typeof MEAL_TYPES)[number];

export default function Nutrition() {
  const [day, setDay] = useState<NutritionDay | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [goal, setGoal] = useState("general");
  const [diet, setDiet] = useState("no_preference");

  const [adding, setAdding] = useState<MealType | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const d = await data.getNutrition();
      setDay(d);
      if (d.profile) {
        setGoal(d.profile.goal);
        setDiet(d.profile.dietary_preference);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your nutrition.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveProfile() {
    setSavingProfile(true);
    try {
      await data.saveNutritionProfile({ goal, dietary_preference: diet });
      await load();
      toast.success("Nutrition targets set.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save your preferences.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function removeEntry(id: string) {
    try {
      await data.deleteMeal(id);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove that meal.");
    }
  }

  if (error) return <div><PageIntro title="Nutrition" /><ErrorScreen message={error} onRetry={load} /></div>;
  if (!day) return <LoadingScreen label="Loading your nutrition…" />;

  // ---- First run: set up goal + dietary preference -------------------------
  if (!day.profile) {
    return (
      <div className="space-y-5">
        <PageIntro title="Nutrition" subtitle="Set a goal and we'll suggest daily meals and targets." />
        <Card className="space-y-5 p-5">
          <div>
            <p className="text-sm font-semibold text-navy-700">What's your goal?</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {NUTRITION_GOALS.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setGoal(g.id)}
                  className={cn(
                    "min-h-[44px] rounded-xl border text-sm font-semibold transition",
                    goal === g.id ? "border-teal-600 bg-teal-600 text-white" : "border-border bg-card text-navy-700"
                  )}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-navy-700">Dietary preference</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {DIETARY_PREFERENCES.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDiet(d.id)}
                  className={cn(
                    "min-h-[40px] rounded-full border px-4 text-sm font-semibold transition",
                    diet === d.id ? "border-teal-600 bg-teal-600 text-white" : "border-border bg-card text-muted-foreground"
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <Button size="lg" className="w-full" disabled={savingProfile} onClick={saveProfile}>
            {savingProfile ? "Saving…" : "Set my nutrition plan"}
          </Button>
          <Disclaimer text={day.disclaimer} />
        </Card>
      </div>
    );
  }

  const t = day.targets!;
  const totals = day.totals;
  const remaining = day.remaining!;
  const loggedByType: Record<string, typeof day.entries> = {};
  for (const e of day.entries) (loggedByType[e.meal_type] ||= []).push(e);

  return (
    <div className="space-y-5">
      <PageIntro title="Nutrition" subtitle="Today" />

      {/* Calorie + macro summary */}
      <Card className="p-5">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Calories</p>
            <p className="mt-1 text-3xl font-extrabold text-navy-700">
              {totals.calories}<span className="text-lg text-muted-foreground"> / {t.calories}</span>
            </p>
          </div>
          <p className={cn("text-sm font-semibold", remaining.calories < 0 ? "text-amber-600" : "text-teal-700")}>
            {remaining.calories >= 0 ? `${remaining.calories} left` : `${Math.abs(remaining.calories)} over`}
          </p>
        </div>
        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-mist">
          <div className="h-full rounded-full bg-teal-600 transition-all" style={{ width: `${pct(totals.calories, t.calories)}%` }} />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <Macro label="Protein" value={totals.protein_g} target={t.protein_g} color="bg-orange-500" />
          <Macro label="Carbs" value={totals.carbs_g} target={t.carbs_g} color="bg-teal-500" />
          <Macro label="Fat" value={totals.fat_g} target={t.fat_g} color="bg-purple-600" />
        </div>
      </Card>

      {day.workedOutToday && (
        <div className="flex items-start gap-2 rounded-xl bg-teal-50 p-3 text-sm text-teal-800">
          <Flame className="mt-0.5 h-4 w-4 shrink-0" />
          <p>You trained today — a protein-rich meal will help you recover.</p>
        </div>
      )}

      {/* Meals by type */}
      {MEAL_TYPES.map((type) => {
        const entries = loggedByType[type] || [];
        const suggestion = day.plan.find((m) => m.meal_type === type);
        return (
          <section key={type}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-bold capitalize text-navy-700">{type}</h2>
              <Button size="sm" variant="ghost" onClick={() => setAdding(type)}>
                <Plus className="h-4 w-4" />Add
              </Button>
            </div>

            {entries.length > 0 ? (
              <ul className="space-y-2">
                {entries.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-navy-700">{e.name}</p>
                      <p className="text-xs text-muted-foreground">{e.calories} kcal · {e.protein_g}p / {e.carbs_g}c / {e.fat_g}f</p>
                    </div>
                    <button aria-label={`Remove ${e.name}`} onClick={() => removeEntry(e.id)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-danger">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : suggestion ? (
              <div className="rounded-xl border border-dashed border-border bg-card/60 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-teal-700">Suggested</p>
                    <p className="truncate text-sm font-semibold text-navy-700">{suggestion.name}</p>
                    <p className="text-xs text-muted-foreground">{suggestion.calories} kcal · {suggestion.protein_g}p / {suggestion.carbs_g}c / {suggestion.fat_g}f</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setAdding(type)}><RefreshCw className="h-3.5 w-3.5" />Swap</Button>
                    <Button size="sm" onClick={() => quickLog(suggestion, load)}><Check className="h-3.5 w-3.5" />Log</Button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-border bg-card/60 p-3 text-sm text-muted-foreground">Nothing logged yet.</p>
            )}
          </section>
        );
      })}

      <Disclaimer text={day.disclaimer} />

      {adding && (
        <AddMealSheet
          type={adding}
          onClose={() => setAdding(null)}
          onLogged={async () => {
            setAdding(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

async function quickLog(meal: Meal, reload: () => Promise<void>) {
  try {
    await data.logMeal({ meal_id: meal.id, meal_type: meal.meal_type });
    toast.success(`Logged ${meal.name}.`);
    await reload();
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Couldn't log that meal.");
  }
}

function pct(value: number, target: number) {
  if (!target) return 0;
  return Math.min(100, Math.round((value / target) * 100));
}

function Macro({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold text-navy-700">{label}</span>
        <span className="text-[11px] text-muted-foreground">{value}/{target}g</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-mist">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct(value, target)}%` }} />
      </div>
    </div>
  );
}

function Disclaimer({ text }: { text: string }) {
  return (
    <p className="flex items-start gap-2 px-1 text-xs leading-relaxed text-muted-foreground">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      {text}
    </p>
  );
}

function AddMealSheet({ type, onClose, onLogged }: { type: MealType; onClose: () => void; onLogged: () => void }) {
  const [meals, setMeals] = useState<Meal[] | null>(null);
  const [tab, setTab] = useState<"suggested" | "manual">("suggested");
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setMeals(await data.getMeals(type));
      } catch {
        setMeals([]);
      }
    })();
  }, [type]);

  async function logCatalogue(meal: Meal) {
    setBusy(true);
    try {
      await data.logMeal({ meal_id: meal.id, meal_type: type });
      toast.success(`Logged ${meal.name}.`);
      onLogged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't log that meal.");
      setBusy(false);
    }
  }

  async function logManual() {
    if (!name.trim()) {
      toast.error("Please name the meal.");
      return;
    }
    setBusy(true);
    try {
      await data.logMeal({
        meal_type: type,
        name: name.trim(),
        calories: Number(calories) || 0,
        protein_g: Number(protein) || 0,
        carbs_g: Number(carbs) || 0,
        fat_g: Number(fat) || 0,
      });
      toast.success("Meal logged.");
      onLogged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't log that meal.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-background p-5"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Add ${type}`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold capitalize text-navy-700">Add {type}</h2>
          <button aria-label="Close" onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 flex gap-1 rounded-xl bg-mist p-1">
          {(["suggested", "manual"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setTab(v)}
              className={cn("min-h-[38px] flex-1 rounded-lg text-sm font-semibold capitalize transition", tab === v ? "bg-white text-navy-700 shadow-sm" : "text-muted-foreground")}
            >
              {v === "suggested" ? "Choose a meal" : "Enter my own"}
            </button>
          ))}
        </div>

        {tab === "suggested" ? (
          meals === null ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-16 w-full" />)}</div>
          ) : meals.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No meal suggestions for this preference.</p>
          ) : (
            <ul className="space-y-2">
              {meals.map((m) => (
                <li key={m.id}>
                  <button
                    disabled={busy}
                    onClick={() => logCatalogue(m)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 text-left transition hover:shadow-card disabled:opacity-50"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700"><Utensils className="h-4 w-4" /></span>
                        <p className="truncate text-sm font-semibold text-navy-700">{m.name}</p>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{m.calories} kcal · {m.protein_g}p / {m.carbs_g}c / {m.fat_g}f</p>
                    </div>
                    <Plus className="h-5 w-5 shrink-0 text-teal-700" />
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : (
          <div className="space-y-3">
            <Field label="Meal name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chicken salad" /></Field>
            <Field label="Calories (kcal)"><Input type="number" inputMode="numeric" value={calories} onChange={(e) => setCalories(e.target.value)} placeholder="0" /></Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Protein (g)"><Input type="number" inputMode="numeric" value={protein} onChange={(e) => setProtein(e.target.value)} placeholder="0" /></Field>
              <Field label="Carbs (g)"><Input type="number" inputMode="numeric" value={carbs} onChange={(e) => setCarbs(e.target.value)} placeholder="0" /></Field>
              <Field label="Fat (g)"><Input type="number" inputMode="numeric" value={fat} onChange={(e) => setFat(e.target.value)} placeholder="0" /></Field>
            </div>
            <Button size="lg" className="w-full" disabled={busy} onClick={logManual}>{busy ? "Logging…" : "Log meal"}</Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-navy-700">{label}</span>
      {children}
    </label>
  );
}
