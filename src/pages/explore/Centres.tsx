import { useEffect, useState } from "react";
import { Search, MapPin, Clock, Accessibility, Navigation, Home, Check } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EmptyState } from "@/components/PageIntro";
import { data } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import type { Gym, GymDetail } from "@/lib/models";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function CentreSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="skeleton h-[76px] w-full" />
      ))}
    </div>
  );
}

export default function Centres() {
  const { profile, refreshProfile } = useAuth();
  const [gyms, setGyms] = useState<Gym[] | null>(null);
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<GymDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setGyms(null);
    const t = setTimeout(() => {
      data.getGyms(query).then((g) => active && setGyms(g)).catch(() => active && setGyms([]));
    }, 200);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query]);

  async function openDetail(id: string) {
    setDetailLoading(true);
    try {
      setDetail(await data.getGym(id));
    } catch {
      toast.error("We couldn't load that centre.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function makeHome(id: string) {
    setSaving(true);
    try {
      await data.changeHomeGym(id);
      await refreshProfile();
      toast.success("Home centre updated");
      setDetail(null);
    } catch {
      toast.error("We couldn't update your home centre.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, city or postcode" />
      </div>

      {gyms === null ? (
        <CentreSkeleton />
      ) : gyms.length === 0 ? (
        <EmptyState icon={<MapPin className="h-6 w-6" />} title="No centres found" body="Try a different name, city or postcode." />
      ) : (
        <ul className="space-y-3">
          {gyms.map((g) => {
            const isHome = profile?.home_gym_id === g.id;
            return (
              <li key={g.id}>
                <button
                  onClick={() => openDetail(g.id)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-card transition hover:shadow-card-hover"
                >
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                    <MapPin className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-bold text-navy-700">{g.name}</span>
                      {isHome && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
                          <Home className="h-3 w-3" /> Home
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {g.city}{g.postcode ? ` · ${g.postcode}` : ""}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Sheet open={Boolean(detail) || detailLoading} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent>
          {detail && (
            <>
              <SheetHeader>
                <SheetTitle>{detail.gym.name}</SheetTitle>
                <p className="text-sm text-muted-foreground">
                  {detail.gym.address ? `${detail.gym.address}, ` : ""}{detail.gym.city}
                </p>
              </SheetHeader>

              <div className="space-y-5 text-left">
                {detail.hours.length > 0 && (
                  <section>
                    <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-navy-700"><Clock className="h-4 w-4 text-teal-700" /> Opening hours</h4>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {detail.hours.map((h) => (
                        <li key={h.day_of_week} className="flex justify-between">
                          <span>{DAY_NAMES[h.day_of_week]}</span>
                          <span>{h.is_closed ? "Closed" : `${(h.open_time || "").slice(0, 5)}–${(h.close_time || "").slice(0, 5)}`}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {detail.amenities.length > 0 && (
                  <section>
                    <h4 className="mb-2 text-sm font-bold text-navy-700">Facilities</h4>
                    <div className="flex flex-wrap gap-2">
                      {detail.amenities.map((a) => (
                        <span key={a} className="rounded-full bg-mist px-3 py-1 text-xs font-medium text-navy-700">{a}</span>
                      ))}
                    </div>
                  </section>
                )}

                {detail.gym.accessibility && (
                  <section>
                    <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-navy-700"><Accessibility className="h-4 w-4 text-teal-700" /> Accessibility</h4>
                    <p className="text-sm text-muted-foreground">{detail.gym.accessibility}</p>
                  </section>
                )}

                <div className="space-y-2 pt-1">
                  {profile?.home_gym_id === detail.gym.id ? (
                    <div className="flex items-center justify-center gap-2 rounded-xl bg-teal-50 py-3 text-sm font-semibold text-teal-700">
                      <Check className="h-4 w-4" /> Your home centre
                    </div>
                  ) : (
                    <Button className="w-full" disabled={saving} onClick={() => makeHome(detail.gym.id)}>
                      <Home className="h-4 w-4" /> {saving ? "Updating…" : "Make this my home centre"}
                    </Button>
                  )}
                  <Button asChild variant="outline" className="w-full">
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${detail.gym.name} ${detail.gym.city}`)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Navigation className="h-4 w-4" /> Directions
                    </a>
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
