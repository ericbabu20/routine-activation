import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CreditCard, Snowflake, Play, MapPin, Receipt, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { LoadingScreen } from "@/components/states";
import { EmptyState } from "@/components/PageIntro";
import { data } from "@/lib/data";
import { formatPrice, type Membership as M, type Invoice } from "@/lib/models";

const STATUS_STYLE: Record<string, string> = {
  active: "bg-teal-50 text-teal-700",
  frozen: "bg-recovery-soft text-recovery-text",
  cancelled: "bg-mist text-muted-foreground",
  pending: "bg-mist text-muted-foreground",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function Membership() {
  const navigate = useNavigate();
  const [membership, setMembership] = useState<M | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { membership, invoices } = await data.getMembership();
      setMembership(membership);
      setInvoices(invoices);
    } catch {
      toast.error("We couldn't load your membership.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function freeze() {
    setBusy(true);
    try { await data.freezeMembership(); await load(); toast.success("Membership frozen"); }
    catch { toast.error("Couldn't freeze membership."); }
    finally { setBusy(false); }
  }
  async function unfreeze() {
    setBusy(true);
    try { await data.unfreezeMembership(); await load(); toast.success("Membership resumed"); }
    catch { toast.error("Couldn't resume membership."); }
    finally { setBusy(false); }
  }
  async function cancel() {
    setBusy(true);
    try { await data.cancelMembership(); setConfirmCancel(false); await load(); toast.success("Membership cancelled"); }
    catch { toast.error("Couldn't cancel membership."); }
    finally { setBusy(false); }
  }

  return (
    <div className="mx-auto min-h-dvh w-full max-w-md px-5 py-6">
      <button onClick={() => navigate(-1)} className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <h1 className="mb-5 text-[28px] font-extrabold text-navy-700">Membership</h1>

      {loading ? (
        <LoadingScreen label="Loading your membership…" />
      ) : !membership ? (
        <EmptyState
          icon={<CreditCard className="h-6 w-6" />}
          title="No active membership"
          body="Choose a plan to unlock centres, classes and your entry pass."
          action={<Button className="w-full" onClick={() => navigate("/onboarding")}>Choose a membership</Button>}
        />
      ) : (
        <div className="space-y-5">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
            <div className="bg-gradient-to-br from-navy-700 to-navy-600 p-5 text-white">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white/80">{membership.plan?.name} plan</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${STATUS_STYLE[membership.status]}`}>
                  {membership.status}
                </span>
              </div>
              <p className="mt-2 text-2xl font-extrabold">
                {membership.plan ? `${formatPrice(membership.plan.price_pence)}` : "—"}
                <span className="text-sm font-medium text-white/70">/{membership.plan?.billing_period || "month"}</span>
              </p>
            </div>
            <dl className="divide-y divide-border">
              <div className="flex items-center justify-between px-5 py-3">
                <dt className="text-sm text-muted-foreground">{membership.status === "frozen" ? "Frozen until" : "Next billing"}</dt>
                <dd className="text-sm font-semibold text-navy-700">{fmtDate(membership.status === "frozen" ? membership.frozen_until : membership.next_billing_at)}</dd>
              </div>
              <div className="flex items-center justify-between px-5 py-3">
                <dt className="text-sm text-muted-foreground">Included centres</dt>
                <dd className="text-sm font-semibold text-navy-700">{membership.plan?.includes_all_centres ? "All centres" : "Home centre"}</dd>
              </div>
              <div className="flex items-center justify-between px-5 py-3">
                <dt className="text-sm text-muted-foreground">Classes</dt>
                <dd className="text-sm font-semibold text-navy-700">{membership.plan?.includes_classes ? "Included" : "Not included"}</dd>
              </div>
            </dl>
          </div>

          {/* Home centre */}
          <button onClick={() => navigate("/explore")} className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-card">
            <MapPin className="h-5 w-5 text-teal-700" />
            <span className="flex-1">
              <span className="block text-sm font-semibold text-navy-700">Home centre</span>
              <span className="block text-xs text-muted-foreground">{membership.home_gym ? `${membership.home_gym.name}, ${membership.home_gym.city}` : "Not set"}</span>
            </span>
            <span className="text-xs font-semibold text-teal-700">Change</span>
          </button>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3">
            {membership.status === "frozen" ? (
              <Button variant="outline" disabled={busy} onClick={unfreeze}><Play className="h-4 w-4" /> Resume</Button>
            ) : (
              <Button variant="outline" disabled={busy || membership.status !== "active"} onClick={freeze}><Snowflake className="h-4 w-4" /> Freeze</Button>
            )}
            <Button variant="outline" className="text-danger-text" disabled={busy} onClick={() => setConfirmCancel(true)}>Cancel</Button>
          </div>

          {/* Invoices */}
          <section>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-navy-700"><Receipt className="h-4 w-4 text-teal-700" /> Invoices</h2>
            {invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No invoices yet.</p>
            ) : (
              <ul className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                {invoices.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between border-b border-border px-4 py-3 last:border-b-0">
                    <span>
                      <span className="block text-sm font-semibold text-navy-700">{inv.description || "Payment"}</span>
                      <span className="block text-xs text-muted-foreground">{fmtDate(inv.created_at)}</span>
                    </span>
                    <span className="text-sm font-semibold text-navy-700">{formatPrice(inv.amount_pence)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="flex items-start gap-2 rounded-xl bg-mist/60 p-4 text-xs leading-relaxed text-muted-foreground">
            <FileText className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Membership terms: billed monthly in test mode. Freeze pauses billing where eligible. Cancel ends access at the end of the current period. No real card data is stored.</p>
          </div>
        </div>
      )}

      <Sheet open={confirmCancel} onOpenChange={setConfirmCancel}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Cancel membership?</SheetTitle>
            <p className="text-sm text-muted-foreground">You'll keep access until the end of your current billing period. You can rejoin anytime.</p>
          </SheetHeader>
          <div className="space-y-2">
            <Button variant="danger" className="w-full" disabled={busy} onClick={cancel}>Yes, cancel membership</Button>
            <Button variant="ghost" className="w-full" onClick={() => setConfirmCancel(false)}>Keep my membership</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
