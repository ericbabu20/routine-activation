import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Search, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { data } from "@/lib/data";
import {
  GOALS, EXPERIENCE_LEVELS, WORKOUT_FORMATS, WEEK_DAYS, formatPrice,
  type Gym, type MembershipPlan,
} from "@/lib/models";
import { cn } from "@/lib/utils";

const STEPS = ["Profile", "Goal", "Centre & plan", "Routine", "AI"] as const;

function SelectCard({ selected, onClick, title, subtitle }: { selected: boolean; onClick: () => void; title: string; subtitle?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-[52px] w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition",
        selected ? "border-teal-600 bg-teal-50" : "border-border bg-card hover:border-teal-200"
      )}
    >
      <span>
        <span className="block text-sm font-semibold text-navy-700">{title}</span>
        {subtitle && <span className="mt-0.5 block text-xs text-muted-foreground">{subtitle}</span>}
      </span>
      {selected && <Check className="h-5 w-5 shrink-0 text-teal-600" />}
    </button>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-[40px] rounded-full border px-4 text-sm font-semibold transition",
        active ? "border-teal-600 bg-teal-600 text-white" : "border-border bg-card text-navy-700"
      )}
    >
      {children}
    </button>
  );
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 — profile
  const [name, setName] = useState(profile?.name ?? "");
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");
  const [experience, setExperience] = useState<string>("");
  // Step 2 — goal
  const [goal, setGoal] = useState<string>("");
  // Step 3 — centre + plan
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [gymQuery, setGymQuery] = useState("");
  const [homeGymId, setHomeGymId] = useState<string>("");
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [planId, setPlanId] = useState<string>("");
  // Step 4 — routine prefs
  const [formats, setFormats] = useState<string[]>([]);
  const [days, setDays] = useState<string[]>([]);
  const [time, setTime] = useState("7:00 PM");
  const [duration, setDuration] = useState(45);
  const [lowEnergy, setLowEnergy] = useState("Weekday evenings");
  const [backupPlan, setBackupPlan] = useState(true);
  // Step 5 — AI
  const [aiMode, setAiMode] = useState<"personalised" | "faq_only" | "disabled">("personalised");

  useEffect(() => {
    data.getPlans().then(setPlans).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      data.getGyms(gymQuery).then(setGyms).catch(() => {});
    }, 200);
    return () => clearTimeout(t);
  }, [gymQuery]);

  const toggle = (list: string[], value: string, setter: (v: string[]) => void) =>
    setter(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

  const canNext = useMemo(() => {
    switch (step) {
      case 0: return name.trim().length > 0;
      case 1: return goal !== "";
      case 2: return homeGymId !== "" && planId !== "";
      case 3: return formats.length > 0 && days.length > 0;
      default: return true;
    }
  }, [step, name, goal, homeGymId, planId, formats, days]);

  async function finish() {
    setBusy(true);
    setError(null);
    try {
      await data.submitOnboarding({
        name: name.trim(),
        date_of_birth: dob || null,
        phone: phone || null,
        fitness_experience: experience || null,
        primary_goal: goal || null,
        home_gym_id: homeGymId || null,
        plan_id: planId || null,
        preferred_formats: formats,
        available_days: days,
        preferred_time: time,
        workout_duration: duration,
        low_energy_periods: lowEnergy,
        backup_plan_enabled: backupPlan,
        ai_mode: aiMode,
        ai_retain_history: aiMode !== "disabled",
      });
      await refreshProfile();
      navigate("/home", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  function back() {
    setError(null);
    if (step === 0) navigate("/home");
    else setStep((s) => s - 1);
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-6">
      {/* Header + progress */}
      <div className="flex items-center gap-3">
        <button onClick={back} aria-label="Back" className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <span key={i} className={cn("h-1.5 flex-1 rounded-full", i <= step ? "bg-teal-600" : "bg-mist")} />
            ))}
          </div>
        </div>
        <span className="w-12 text-right text-xs font-semibold text-muted-foreground">{step + 1}/{STEPS.length}</span>
      </div>

      <div className="mt-7 flex-1 animate-fade-in">
        {step === 0 && (
          <section className="space-y-5">
            <div>
              <h1 className="text-2xl font-extrabold text-navy-700">A little about you</h1>
              <p className="mt-1 text-sm text-muted-foreground">This helps us personalise your routine.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="dob">Date of birth</Label>
                <Input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Experience</Label>
              <div className="space-y-2">
                {EXPERIENCE_LEVELS.map((x) => (
                  <SelectCard key={x.id} selected={experience === x.id} onClick={() => setExperience(x.id)} title={x.label} />
                ))}
              </div>
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="space-y-5">
            <div>
              <h1 className="text-2xl font-extrabold text-navy-700">What's your main goal?</h1>
              <p className="mt-1 text-sm text-muted-foreground">Pick the one that matters most right now.</p>
            </div>
            <div className="space-y-2">
              {GOALS.map((g) => (
                <SelectCard key={g.id} selected={goal === g.id} onClick={() => setGoal(g.id)} title={g.label} />
              ))}
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="space-y-6">
            <div>
              <h1 className="text-2xl font-extrabold text-navy-700">Your home centre</h1>
              <p className="mt-1 text-sm text-muted-foreground">Search by name, city or postcode.</p>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" value={gymQuery} onChange={(e) => setGymQuery(e.target.value)} placeholder="Search centres" />
            </div>
            <div className="space-y-2">
              {gyms.map((g) => (
                <SelectCard key={g.id} selected={homeGymId === g.id} onClick={() => setHomeGymId(g.id)} title={g.name} subtitle={`${g.city}${g.postcode ? ` · ${g.postcode}` : ""}`} />
              ))}
              {gyms.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No centres match that search.</p>}
            </div>

            <div>
              <h2 className="text-lg font-extrabold text-navy-700">Choose a membership</h2>
              <div className="mt-3 space-y-2">
                {plans.map((p) => (
                  <SelectCard
                    key={p.id}
                    selected={planId === p.id}
                    onClick={() => setPlanId(p.id)}
                    title={`${p.name} — ${formatPrice(p.price_pence)}/mo`}
                    subtitle={p.description ?? undefined}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="space-y-6">
            <div>
              <h1 className="text-2xl font-extrabold text-navy-700">Shape your routine</h1>
              <p className="mt-1 text-sm text-muted-foreground">Consistency across weeks matters more than a perfect streak.</p>
            </div>
            <div className="space-y-2">
              <Label>Preferred formats</Label>
              <div className="flex flex-wrap gap-2">
                {WORKOUT_FORMATS.map((f) => (
                  <Chip key={f} active={formats.includes(f)} onClick={() => toggle(formats, f, setFormats)}>{f}</Chip>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Available days</Label>
              <div className="flex flex-wrap gap-2">
                {WEEK_DAYS.map((d) => (
                  <Chip key={d} active={days.includes(d)} onClick={() => toggle(days, d, setDays)}>{d.slice(0, 3)}</Chip>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="time">Preferred time</Label>
                <Input id="time" value={time} onChange={(e) => setTime(e.target.value)} placeholder="7:00 PM" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="duration">Duration (min)</Label>
                <select
                  id="duration"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="flex h-11 w-full rounded-xl border border-input bg-white px-3 text-sm text-navy-700 shadow-sm"
                >
                  {[20, 30, 45, 60].map((d) => <option key={d} value={d}>{d} min</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="low">Low-energy periods</Label>
              <Input id="low" value={lowEnergy} onChange={(e) => setLowEnergy(e.target.value)} placeholder="e.g. Weekday evenings" />
            </div>
            <label className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
              <span className="text-sm font-semibold text-navy-700">Enable a backup plan for low-energy days</span>
              <input type="checkbox" checked={backupPlan} onChange={(e) => setBackupPlan(e.target.checked)} className="h-5 w-5 accent-teal-600" />
            </label>
          </section>
        )}

        {step === 4 && (
          <section className="space-y-5">
            <div>
              <h1 className="text-2xl font-extrabold text-navy-700">Your Routine Assistant</h1>
              <p className="mt-1 text-sm text-muted-foreground">Optional AI help. You're always in control.</p>
            </div>
            <div className="rounded-xl bg-purple-50 p-4 text-sm leading-relaxed text-navy-700">
              <Info className="mb-1 h-4 w-4 text-purple-600" />
              The assistant can use your routine, schedule and progress to answer questions. It's
              optional, you can turn it off anytime, and you can delete chat history. It never gives
              medical advice.
            </div>
            <div className="space-y-2">
              <SelectCard selected={aiMode === "personalised"} onClick={() => setAiMode("personalised")} title="Personalised assistant" subtitle="Uses your routine & progress to help" />
              <SelectCard selected={aiMode === "faq_only"} onClick={() => setAiMode("faq_only")} title="General help only" subtitle="Answers common questions, no personal data" />
              <SelectCard selected={aiMode === "disabled"} onClick={() => setAiMode("disabled")} title="Skip for now" subtitle="You can enable this later in Profile" />
            </div>
          </section>
        )}
      </div>

      {error && (
        <p role="alert" className="mb-3 rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger-text">{error}</p>
      )}

      <div className="pt-4">
        {step < STEPS.length - 1 ? (
          <Button size="lg" className="w-full" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
            Continue
          </Button>
        ) : (
          <Button size="lg" className="w-full" disabled={busy} onClick={finish}>
            {busy ? "Setting up…" : "Finish setup"}
          </Button>
        )}
      </div>
    </div>
  );
}
