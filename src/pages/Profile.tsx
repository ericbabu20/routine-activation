import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, User as UserIcon, CreditCard, ShieldCheck, ChevronRight, HeartHandshake, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageIntro } from "@/components/PageIntro";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { data } from "@/lib/data";

function Row({ icon, label, hint, onClick }: { icon: React.ReactNode; label: string; hint?: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[56px] w-full items-center gap-3 border-b border-border px-4 text-left last:border-b-0 hover:bg-muted/50"
    >
      <span className="text-teal-700">{icon}</span>
      <span className="flex-1 text-sm font-semibold text-navy-700">{label}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}

export default function Profile() {
  const { profile, user, signOut } = useAuth();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);

  async function handleSignOut() {
    await signOut();
    navigate("/", { replace: true });
  }

  async function handleDeleteAccount() {
    const confirmed = window.confirm(
      "Delete your account? This permanently removes your profile, routine, workouts, bookings, nutrition and buddy connections. This cannot be undone."
    );
    if (!confirmed) return;
    setDeleting(true);
    try {
      await data.deleteAccount();
      await signOut();
      toast.success("Your account has been deleted.");
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete your account.");
      setDeleting(false);
    }
  }

  return (
    <div>
      <PageIntro title="Profile" />

      <div className="mb-6 flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-card">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
          <UserIcon className="h-7 w-7" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-lg font-extrabold text-navy-700">{profile?.name || "Your account"}</p>
          <p className="truncate text-sm text-muted-foreground">{profile?.email || user?.email}</p>
        </div>
      </div>

      <div className="mb-6 overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <Row icon={<CreditCard className="h-5 w-5" />} label="Membership" onClick={() => navigate("/membership")} />
        <Row icon={<HeartHandshake className="h-5 w-5" />} label="Trusted buddy" onClick={() => navigate("/buddy")} />
        <Row icon={<ShieldCheck className="h-5 w-5" />} label="Privacy & AI settings" onClick={() => navigate("/settings/ai")} />
      </div>

      <Button variant="outline" size="lg" className="w-full" onClick={handleSignOut}>
        <LogOut className="h-5 w-5" />
        Sign out
      </Button>

      <button
        type="button"
        onClick={handleDeleteAccount}
        disabled={deleting}
        className="mt-4 flex w-full items-center justify-center gap-2 py-2 text-sm font-semibold text-danger hover:underline disabled:opacity-50"
      >
        <Trash2 className="h-4 w-4" />
        {deleting ? "Deleting…" : "Delete my account"}
      </button>
    </div>
  );
}
