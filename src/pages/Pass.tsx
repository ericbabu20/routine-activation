import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { QrCode, MapPin, Clock, ShieldCheck, RefreshCw, Copy } from "lucide-react";
import { PageIntro, EmptyState } from "@/components/PageIntro";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { apiGet, apiSend } from "@/lib/api";
import { toast } from "sonner";

interface PassData {
  member: { name: string | null; email: string | null };
  membership: {
    status: string;
    plan: { name: string; includes_all_centres: boolean; includes_classes: boolean } | null;
    home_gym: { name: string; city: string } | null;
  } | null;
  canEnter: boolean;
  activeVisit: { id: string; check_in_at: string; gym: { name: string; city: string } | null } | null;
  recentVisits: Array<{
    id: string;
    check_in_at: string;
    check_out_at: string | null;
    duration_min: number | null;
    status: string;
    gym: { name: string; city: string } | null;
  }>;
}

interface TokenData {
  token: string;
  expires_at: string;
  ttl_seconds: number;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function Pass() {
  const [pass, setPass] = useState<PassData | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<TokenData | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const refreshing = useRef(false);

  const loadPass = useCallback(async () => {
    try {
      const data = await apiGet<PassData>("/api/pass");
      setPass(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't load your pass.");
    } finally {
      setLoading(false);
    }
  }, []);

  const rotateToken = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    try {
      const data = await apiSend<TokenData>("/api/pass/token", "POST");
      setToken(data);
      setSecondsLeft(Math.max(1, Math.round((new Date(data.expires_at).getTime() - Date.now()) / 1000)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't generate a pass.");
    } finally {
      refreshing.current = false;
    }
  }, []);

  useEffect(() => {
    loadPass();
  }, [loadPass]);

  // Once we know the member can enter, keep a fresh token available.
  useEffect(() => {
    if (pass?.canEnter) rotateToken();
  }, [pass?.canEnter, rotateToken]);

  // Countdown + auto-rotate a few seconds before expiry.
  useEffect(() => {
    if (!pass?.canEnter || !token) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          rotateToken();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [pass?.canEnter, token, rotateToken]);

  if (loading) {
    return (
      <div>
        <PageIntro title="Your pass" subtitle="Scan in at your centre." />
        <div className="mx-auto h-64 w-full max-w-xs animate-pulse rounded-3xl bg-mist" />
      </div>
    );
  }

  if (!pass?.canEnter) {
    return (
      <div>
        <PageIntro title="Your pass" subtitle="Scan in at your centre." />
        <EmptyState
          icon={<QrCode className="h-6 w-6" />}
          title={pass?.membership?.status === "frozen" ? "Your membership is frozen" : "No active membership yet"}
          body={
            pass?.membership?.status === "frozen"
              ? "Unfreeze your membership to generate your entry pass."
              : "Choose a home centre and membership to unlock your secure entry pass."
          }
          action={
            <Button asChild size="lg" className="w-full">
              <Link to={pass?.membership?.status === "frozen" ? "/membership" : "/onboarding"}>
                {pass?.membership?.status === "frozen" ? "Manage membership" : "Choose a membership"}
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <PageIntro title="Your pass" subtitle="Show this at the entrance to check in." />

      {pass.activeVisit && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          Checked in at {pass.activeVisit.gym?.name ?? "your centre"} since {formatTime(pass.activeVisit.check_in_at)}
        </div>
      )}

      {/* Secure rotating QR pass */}
      <div className="mx-auto max-w-xs rounded-3xl border border-border bg-card p-6 shadow-card">
        <div className="flex items-center justify-center rounded-2xl bg-white p-4">
          {token ? (
            <QRCodeSVG value={token.token} size={196} level="M" marginSize={0} />
          ) : (
            <div className="h-[196px] w-[196px] animate-pulse rounded-xl bg-mist" />
          )}
        </div>

        <div className="mt-4 flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground">
          <RefreshCw className="h-3.5 w-3.5" />
          {token ? `Refreshes in ${secondsLeft}s` : "Generating…"}
        </div>

        <p className="mt-1 text-center text-sm font-bold text-navy-700">
          {pass.member.name || pass.member.email}
        </p>
        {pass.membership?.plan && (
          <p className="text-center text-xs text-muted-foreground">
            {pass.membership.plan.name} · {pass.membership.plan.includes_all_centres ? "All centres" : pass.membership.home_gym?.name}
          </p>
        )}

        {/* Dev-only helper for the local turnstile simulator (scripts/access-sim.js). */}
        {import.meta.env.DEV && token && (
          <button
            onClick={() => {
              navigator.clipboard.writeText(token.token);
              toast.success("Token copied (dev)");
            }}
            className="mx-auto mt-3 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-navy-700"
          >
            <Copy className="h-3 w-3" /> Copy token (dev)
          </button>
        )}
      </div>

      <p className="mx-auto mt-3 max-w-xs text-center text-xs text-muted-foreground">
        Your pass is unique to you and refreshes automatically. Never share a screenshot.
      </p>

      {/* Recent visits */}
      <div className="mt-8">
        <h2 className="mb-3 text-sm font-bold text-navy-700">Recent visits</h2>
        {pass.recentVisits.length === 0 ? (
          <p className="text-sm text-muted-foreground">No visits yet — your check-ins will show here.</p>
        ) : (
          <ul className="space-y-2">
            {pass.recentVisits.map((v) => (
              <li key={v.id} className="flex items-center justify-between rounded-2xl border border-border bg-card p-3.5 text-sm">
                <span className="flex items-center gap-2 font-medium text-navy-700">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  {v.gym?.name ?? "Centre"}
                </span>
                <span className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{formatDate(v.check_in_at)}</span>
                  {v.duration_min ? (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {v.duration_min}m
                    </span>
                  ) : v.status === "active" ? (
                    <span className="font-semibold text-green-600">In progress</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
