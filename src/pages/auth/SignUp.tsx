import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { AuthShell } from "./AuthShell";
import { GoogleButton } from "@/components/GoogleButton";

export default function SignUp() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Please choose a password with at least 8 characters.");
      return;
    }
    setBusy(true);
    const { error, needsEmailConfirm } = await signUp(email.trim(), password, name.trim());
    setBusy(false);
    if (error) {
      setError(error);
      return;
    }
    if (needsEmailConfirm) {
      setEmailSent(true);
      return;
    }
    navigate("/", { replace: true });
  }

  if (emailSent) {
    return (
      <AuthShell title="Check your inbox" subtitle={`We've sent a confirmation link to ${email}.`}>
        <div className="flex flex-col items-center rounded-2xl border border-border bg-card p-8 text-center shadow-card">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
            <MailCheck className="h-7 w-7" />
          </span>
          <p className="mt-4 text-[15px] text-muted-foreground">
            Confirm your email, then come back and sign in to start building your routine.
          </p>
          <Button asChild variant="outline" className="mt-6 w-full">
            <Link to="/sign-in">Go to sign in</Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="It takes about a minute. No pressure, no streaks."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/sign-in" className="font-semibold text-teal-700 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <GoogleButton label="Sign up with Google" />

      <form onSubmit={onSubmit} className="mt-4 space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="name">First name</Label>
          <Input
            id="name"
            autoComplete="given-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Maya"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger-text">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? "Creating account…" : "Create account"}
        </Button>
        <p className="px-1 text-center text-xs leading-relaxed text-muted-foreground">
          By continuing you agree to our Terms and acknowledge our Privacy Policy.
        </p>
      </form>
    </AuthShell>
  );
}
