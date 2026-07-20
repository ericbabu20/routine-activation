import { useEffect, useState } from "react";
import { Footprints, MapPin, Clock } from "lucide-react";
import { PageIntro, EmptyState } from "@/components/PageIntro";
import { apiGet } from "@/lib/api";
import { toast } from "sonner";

interface ActivityData {
  stats: {
    totalVisits: number;
    visitsThisMonth: number;
    avgPerWeek: number;
    avgDurationMin: number | null;
  };
  visits: Array<{
    id: string;
    check_in_at: string;
    check_out_at: string | null;
    duration_min: number | null;
    status: string;
    gym: { name: string; city: string } | null;
  }>;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function Activity() {
  const [data, setData] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<ActivityData>("/api/activity")
      .then(setData)
      .catch((err) => toast.error(err instanceof Error ? err.message : "Couldn't load activity."))
      .finally(() => setLoading(false));
  }, []);

  const stats = data?.stats;
  const cards = [
    { label: "Visits this month", value: stats ? String(stats.visitsThisMonth) : "—" },
    { label: "Total visits", value: stats ? String(stats.totalVisits) : "—" },
    { label: "Avg / week", value: stats ? String(stats.avgPerWeek) : "—" },
    { label: "Avg duration", value: stats?.avgDurationMin ? `${stats.avgDurationMin}m` : "—" },
  ];

  return (
    <div>
      <PageIntro title="Activity" subtitle="Your visits and progress." />

      <div className="mb-6 grid grid-cols-2 gap-3">
        {cards.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <p className="text-2xl font-extrabold text-navy-700">{loading ? "…" : s.value}</p>
            <p className="mt-0.5 text-xs font-medium text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <h2 className="mb-3 text-sm font-bold text-navy-700">Visit history</h2>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-mist" />
          ))}
        </div>
      ) : !data?.visits.length ? (
        <EmptyState
          icon={<Footprints className="h-6 w-6" />}
          title="No visits yet"
          body="Once you check in at a centre, your visits and workout history will appear here."
        />
      ) : (
        <ul className="space-y-2">
          {data.visits.map((v) => (
            <li key={v.id} className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold text-navy-700">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  {v.gym?.name ?? "Centre"}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatDate(v.check_in_at)} · {formatTime(v.check_in_at)}
                </p>
              </div>
              <div className="text-right">
                {v.status === "active" ? (
                  <span className="text-xs font-semibold text-green-600">In progress</span>
                ) : v.duration_min ? (
                  <span className="flex items-center gap-1 text-sm font-medium text-navy-700">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    {v.duration_min}m
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
