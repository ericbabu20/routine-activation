import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Clock, MapPin, User, Users, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/PageIntro";
import { cn } from "@/lib/utils";
import { data } from "@/lib/data";
import type { ClassSession, Booking, WaitlistEntry } from "@/lib/models";

const FORMATS = ["Strength", "HIIT", "Yoga", "Cardio", "Mobility"];
const INTENSITIES = [
  { id: "low", label: "Low" },
  { id: "moderate", label: "Moderate" },
  { id: "high", label: "High" },
];

function nextDays(n: number) {
  const out: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const label = i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" });
    out.push({ value, label });
  }
  return out;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

const INTENSITY_STYLES: Record<string, string> = {
  low: "bg-teal-50 text-teal-700",
  moderate: "bg-amber-50 text-amber-700",
  high: "bg-red-50 text-red-700",
};

const DAYS = nextDays(7);

export default function Classes() {
  const [view, setView] = useState<"discover" | "booked">("discover");

  // Discover state
  const [date, setDate] = useState<string>("");
  const [format, setFormat] = useState<string>("");
  const [intensity, setIntensity] = useState<string>("");
  const [available, setAvailable] = useState(false);
  const [sessions, setSessions] = useState<ClassSession[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Booked state
  const [upcoming, setUpcoming] = useState<Booking[] | null>(null);
  const [waitlists, setWaitlists] = useState<WaitlistEntry[]>([]);

  const loadSessions = useCallback(async () => {
    setSessions(null);
    try {
      const s = await data.getClasses({ date, format, intensity, available });
      setSessions(s);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't load classes.");
      setSessions([]);
    }
  }, [date, format, intensity, available]);

  const loadBookings = useCallback(async () => {
    setUpcoming(null);
    try {
      const r = await data.getBookings();
      setUpcoming(r.upcoming);
      setWaitlists(r.waitlists);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't load your bookings.");
      setUpcoming([]);
    }
  }, []);

  useEffect(() => {
    if (view === "discover") loadSessions();
    else loadBookings();
  }, [view, loadSessions, loadBookings]);

  async function book(s: ClassSession) {
    setBusyId(s.id);
    try {
      await data.bookClass(s.id);
      toast.success("You're booked in!");
      await loadSessions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't book that class.");
    } finally {
      setBusyId(null);
    }
  }

  async function waitlist(s: ClassSession) {
    setBusyId(s.id);
    try {
      const r = await data.joinWaitlist(s.id);
      toast.success(`Added to the waitlist (position ${r.position}).`);
      await loadSessions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't join the waitlist.");
    } finally {
      setBusyId(null);
    }
  }

  async function leaveWaitlist(s: ClassSession) {
    setBusyId(s.id);
    try {
      await data.leaveWaitlist(s.id);
      toast.success("Left the waitlist.");
      await loadSessions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update the waitlist.");
    } finally {
      setBusyId(null);
    }
  }

  async function cancel(bookingId: string) {
    setBusyId(bookingId);
    try {
      const r = await data.cancelBooking(bookingId);
      toast.success(r.promoted ? "Cancelled — the next person got your spot." : "Booking cancelled.");
      await loadBookings();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't cancel that booking.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      {/* Discover / Booked toggle */}
      <div className="mb-4 flex gap-1 rounded-xl bg-mist p-1">
        {(["discover", "booked"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              "min-h-[38px] flex-1 rounded-lg text-sm font-semibold capitalize transition",
              view === v ? "bg-white text-navy-700 shadow-sm" : "text-muted-foreground"
            )}
          >
            {v === "booked" ? "My classes" : "Discover"}
          </button>
        ))}
      </div>

      {view === "discover" ? (
        <>
          {/* Filters */}
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            <Chip active={date === ""} onClick={() => setDate("")}>Any day</Chip>
            {DAYS.map((d) => (
              <Chip key={d.value} active={date === d.value} onClick={() => setDate(d.value)}>{d.label}</Chip>
            ))}
          </div>
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            <Chip active={format === ""} onClick={() => setFormat("")}>All formats</Chip>
            {FORMATS.map((f) => (
              <Chip key={f} active={format === f} onClick={() => setFormat(f)}>{f}</Chip>
            ))}
          </div>
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {INTENSITIES.map((i) => (
              <Chip key={i.id} active={intensity === i.id} onClick={() => setIntensity(intensity === i.id ? "" : i.id)}>{i.label}</Chip>
            ))}
            <Chip active={available} onClick={() => setAvailable((a) => !a)}>Available only</Chip>
          </div>

          {sessions === null ? (
            <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-[104px] w-full" />)}</div>
          ) : sessions.length === 0 ? (
            <EmptyState icon={<CalendarDays className="h-6 w-6" />} title="No classes match" body="Try a different day, format or intensity." />
          ) : (
            <ul className="space-y-3">
              {sessions.map((s) => (
                <li key={s.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-sm font-bold text-navy-700">{s.class.title}</h3>
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize", INTENSITY_STYLES[s.class.intensity])}>
                          {s.class.intensity}
                        </span>
                      </div>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{fmtDay(s.starts_at)} · {fmtTime(s.starts_at)}</span>
                        {s.class.trainer && <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{s.class.trainer}</span>}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{s.gym?.name}</span>
                        <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{s.isFull ? "Full" : `${s.spotsLeft} left`}</span>
                      </p>
                    </div>
                  </div>

                  <div className="mt-3">
                    {s.myBookingId ? (
                      <div className="flex items-center gap-2 rounded-xl bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-700">
                        <Check className="h-4 w-4" /> Booked
                      </div>
                    ) : s.myWaitlistPosition != null ? (
                      <Button variant="outline" className="w-full" disabled={busyId === s.id} onClick={() => leaveWaitlist(s)}>
                        On waitlist · #{s.myWaitlistPosition} — tap to leave
                      </Button>
                    ) : s.isFull ? (
                      <Button variant="outline" className="w-full" disabled={busyId === s.id} onClick={() => waitlist(s)}>
                        {busyId === s.id ? "…" : "Join waitlist"}
                      </Button>
                    ) : (
                      <Button className="w-full" disabled={busyId === s.id} onClick={() => book(s)}>
                        {busyId === s.id ? "…" : "Book"}
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          {upcoming === null ? (
            <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="skeleton h-[92px] w-full" />)}</div>
          ) : upcoming.length === 0 && waitlists.length === 0 ? (
            <EmptyState icon={<CalendarDays className="h-6 w-6" />} title="No upcoming classes" body="Book a class from Discover and it'll show up here." />
          ) : (
            <div className="space-y-6">
              {upcoming.length > 0 && (
                <section>
                  <h3 className="mb-2 text-sm font-bold text-navy-700">Upcoming</h3>
                  <ul className="space-y-3">
                    {upcoming.map((b) => (
                      <li key={b.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                        <h4 className="text-sm font-bold text-navy-700">{b.session?.class?.title}</h4>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{b.session && `${fmtDay(b.session.starts_at)} · ${fmtTime(b.session.starts_at)}`}</span>
                          <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{b.session?.gym?.name}</span>
                        </p>
                        <Button variant="outline" className="mt-3 w-full" disabled={busyId === b.id} onClick={() => cancel(b.id)}>
                          <X className="h-4 w-4" /> {busyId === b.id ? "…" : "Cancel booking"}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {waitlists.length > 0 && (
                <section>
                  <h3 className="mb-2 text-sm font-bold text-navy-700">On the waitlist</h3>
                  <ul className="space-y-3">
                    {waitlists.map((w) => (
                      <li key={w.session?.id} className="rounded-2xl border border-border bg-card p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-sm font-bold text-navy-700">{w.session?.class?.title}</h4>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {w.session && `${fmtDay(w.session.starts_at)} · ${fmtTime(w.session.starts_at)}`}
                            </p>
                          </div>
                          <span className="rounded-full bg-mist px-3 py-1 text-xs font-semibold text-navy-700">#{w.position}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}
        </>
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
