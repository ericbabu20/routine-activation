import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, HeartHandshake, Shield, UserPlus, X, BellOff, Bell } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LoadingScreen, ErrorScreen } from "@/components/states";
import { cn } from "@/lib/utils";
import { data } from "@/lib/data";
import type { BuddyData, BuddyConnection, BuddySupporting } from "@/lib/models";

const PRIVACY_NOTE =
  "Your buddy can only ever see your next workout, your support requests and their confirmation. They can never see your attendance, missed sessions, health, nutrition, visits or notes.";

export default function Buddy() {
  const [state, setState] = useState<BuddyData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setState(await data.getBuddy());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your buddy details.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto min-h-dvh w-full max-w-md bg-background pb-16">
      <header className="flex items-center gap-2 px-5 pt-6">
        <Link to="/profile" aria-label="Back to profile" className="rounded-lg p-1 text-navy-700 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-bold text-navy-700">Trusted buddy</h1>
      </header>

      <div className="space-y-5 px-5 pt-4">
        {error ? (
          <ErrorScreen message={error} onRetry={load} />
        ) : !state ? (
          <LoadingScreen label="Loading your buddy…" />
        ) : (
          <>
            <p className="flex items-start gap-2 rounded-xl bg-teal-50 p-3 text-xs leading-relaxed text-teal-800">
              <Shield className="mt-0.5 h-4 w-4 shrink-0" />
              {PRIVACY_NOTE}
            </p>

            <OwnerSection connection={state.connection} reload={load} />

            {state.supporting.length > 0 && <SupportingSection supporting={state.supporting} reload={load} />}
          </>
        )}
      </div>
    </div>
  );
}

function OwnerSection({ connection, reload }: { connection: BuddyConnection | null; reload: () => Promise<void> }) {
  if (!connection) return <InviteForm reload={reload} />;
  if (connection.status === "pending") {
    return (
      <Card className="p-5">
        <h2 className="text-sm font-bold text-navy-700">Invitation sent</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Waiting for <span className="font-semibold text-navy-700">{connection.buddyEmail}</span> to accept.
        </p>
        <Button variant="outline" className="mt-4" onClick={() => disconnect(connection.id, reload)}>Cancel invitation</Button>
      </Card>
    );
  }
  return <ActiveBuddy connection={connection} reload={reload} />;
}

function InviteForm({ reload }: { reload: () => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [relationship, setRelationship] = useState("");
  const [shareNext, setShareNext] = useState(true);
  const [shareReq, setShareReq] = useState(true);
  const [shareConf, setShareConf] = useState(true);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function invite() {
    if (!consent) {
      toast.error("Please tick the consent box to continue.");
      return;
    }
    setBusy(true);
    try {
      await data.inviteBuddy({
        email,
        relationship,
        share_next_workout: shareNext,
        share_support_requests: shareReq,
        share_confirmation: shareConf,
        consent,
      });
      toast.success("Invitation sent.");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send that invitation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-4 p-5">
      <div>
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-500"><HeartHandshake className="h-5 w-5" /></span>
          <h2 className="text-sm font-bold text-navy-700">Add a trusted buddy</h2>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Invite one person to gently cheer you on. It's completely optional — everything works without a buddy.
        </p>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-navy-700">Their email (must be a Routine member)</span>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="buddy@example.com" />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-navy-700">Relationship (optional)</span>
        <Input value={relationship} onChange={(e) => setRelationship(e.target.value)} placeholder="e.g. Friend, Partner, Sibling" />
      </label>

      <div className="space-y-1">
        <p className="text-xs font-semibold text-navy-700">What you'll share</p>
        <Toggle label="My next workout" on={shareNext} onChange={setShareNext} />
        <Toggle label="My support requests" on={shareReq} onChange={setShareReq} />
        <Toggle label="Their confirmation status" on={shareConf} onChange={setShareConf} />
      </div>

      <label className="flex items-start gap-2 text-sm text-navy-700">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-input" />
        <span>I consent to sharing the information selected above with this buddy.</span>
      </label>

      <Button size="lg" className="w-full" disabled={busy || !email} onClick={invite}>
        <UserPlus className="h-5 w-5" />{busy ? "Sending…" : "Send invitation"}
      </Button>
    </Card>
  );
}

function ActiveBuddy({ connection, reload }: { connection: BuddyConnection; reload: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);

  async function setSharing(patch: Record<string, boolean>) {
    try {
      await data.updateBuddySharing(connection.id, patch);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update sharing.");
    }
  }

  async function requestSupport() {
    setBusy(true);
    try {
      await data.requestBuddySupport();
      toast.success(`Asked ${connection.buddyName || "your buddy"} to support your next session.`);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send that request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-white"><HeartHandshake className="h-5 w-5" /></span>
          <div>
            <p className="text-sm font-bold text-navy-700">{connection.buddyName}</p>
            <p className="text-xs text-muted-foreground">{connection.relationship || "Connected"} · Active</p>
          </div>
        </div>
        <button
          aria-label={connection.muted ? "Unmute buddy prompts" : "Mute buddy prompts"}
          onClick={() => setSharing({ muted: !connection.muted })}
          className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
        >
          {connection.muted ? <BellOff className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
        </button>
      </div>

      <Button className="w-full" disabled={busy || !connection.share_support_requests} onClick={requestSupport}>
        {busy ? "Sending…" : "Ask my buddy to support my next session"}
      </Button>
      {!connection.share_support_requests && (
        <p className="text-xs text-muted-foreground">Turn on "My support requests" below to send a request.</p>
      )}

      <div className="space-y-1 border-t border-border pt-3">
        <p className="text-xs font-semibold text-navy-700">Sharing controls</p>
        <Toggle label="My next workout" on={connection.share_next_workout} onChange={(v) => setSharing({ share_next_workout: v })} />
        <Toggle label="My support requests" on={connection.share_support_requests} onChange={(v) => setSharing({ share_support_requests: v })} />
        <Toggle label="Their confirmation status" on={connection.share_confirmation} onChange={(v) => setSharing({ share_confirmation: v })} />
      </div>

      <Button variant="ghost" className="w-full text-danger hover:text-danger" onClick={() => disconnect(connection.id, reload)}>
        Disconnect buddy
      </Button>
    </Card>
  );
}

function SupportingSection({ supporting, reload }: { supporting: BuddySupporting[]; reload: () => Promise<void> }) {
  async function respond(id: string, accept: boolean) {
    try {
      await data.respondBuddy(id, accept);
      await reload();
      toast.success(accept ? "You're now their buddy." : "Invitation declined.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't respond.");
    }
  }
  async function confirm(id: string) {
    try {
      await data.confirmBuddySupport(id);
      await reload();
      toast.success("Confirmed — nice support!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't confirm.");
    }
  }

  return (
    <section>
      <h2 className="mb-2 text-sm font-bold text-navy-700">You're supporting</h2>
      <div className="space-y-3">
        {supporting.map((s) => (
          <Card key={s.id} className="p-4">
            {s.status === "pending" ? (
              <div>
                <p className="text-sm text-navy-700">
                  <span className="font-semibold">{s.ownerName}</span> asked you to be their trusted buddy.
                </p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={() => respond(s.id, true)}><Check className="h-4 w-4" />Accept</Button>
                  <Button size="sm" variant="ghost" onClick={() => respond(s.id, false)}><X className="h-4 w-4" />Decline</Button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-sm font-bold text-navy-700">{s.ownerName}</p>
                <p className="text-xs text-muted-foreground">{s.relationship || "Your buddy"}</p>
                {s.sharedNextWorkout && (
                  <p className="mt-2 rounded-lg bg-mist px-3 py-2 text-xs text-navy-700">
                    Next session: <span className="font-semibold">{s.sharedNextWorkout.title}</span>
                    {s.sharedNextWorkout.date ? ` · ${new Date(`${s.sharedNextWorkout.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}` : ""}
                  </p>
                )}
                {s.supportRequests.length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    {s.supportRequests.map((r) => (
                      <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-navy-700">Support: {r.workout_title}</p>
                          {r.message && <p className="truncate text-xs text-muted-foreground">"{r.message}"</p>}
                        </div>
                        {r.status === "confirmed" ? (
                          <span className="flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700"><Check className="h-3.5 w-3.5" />Confirmed</span>
                        ) : (
                          <Button size="sm" onClick={() => confirm(r.id)}>Confirm</Button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">No support requests right now.</p>
                )}
                <Button variant="ghost" className="mt-3 w-full text-danger hover:text-danger" onClick={() => disconnect(s.id, reload)}>
                  Stop supporting
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>
    </section>
  );
}

async function disconnect(id: string, reload: () => Promise<void>) {
  if (!window.confirm("Disconnect this buddy? You can always add one again later.")) return;
  try {
    await data.disconnectBuddy(id);
    await reload();
    toast.success("Buddy disconnected.");
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Couldn't disconnect.");
  }
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-navy-700">{label}</span>
      <button
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => onChange(!on)}
        className={cn("relative h-6 w-11 rounded-full transition-colors", on ? "bg-teal-600" : "bg-mist")}
      >
        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
      </button>
    </div>
  );
}
