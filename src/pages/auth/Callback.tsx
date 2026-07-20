import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthShell } from "./AuthShell";
import { useAuth } from "@/lib/auth";

// Handles the return trip from Google. The Supabase client (PKCE, with
// detectSessionInUrl) exchanges the ?code=... automatically on load; we just
// wait for the session and route the member onward, with clear error/retry.
export default function Callback() {
  const { status } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Provider-side errors come back as query params.
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error_description") || params.get("error");
    if (err) {
      setError(
        /access_denied|cancel/i.test(err)
          ? "Sign-in was cancelled. You can try again whenever you're ready."
          : "We couldn't complete Google sign-in. Please try again."
      );
      return;
    }
    // If neither a code nor a session token is present, this page was opened directly.
    if (!params.get("code") && !window.location.hash.includes("access_token")) {
      // Give the client a moment; if still signed out, show a gentle error below.
    }
  }, []);

  useEffect(() => {
    if (error) return;
    if (status === "signedIn") {
      navigate("/", { replace: true });
      return;
    }
    // Fallback: this effect re-runs (and clears the timer) the moment we're
    // signed in, so if the timer ever fires we know sign-in didn't complete.
    const t = setTimeout(() => {
      setError("Sign-in is taking longer than expected. Please try again.");
    }, 9000);
    return () => clearTimeout(t);
  }, [status, error, navigate]);

  if (error) {
    return (
      <AuthShell title="Sign-in problem" subtitle="Let's get you back on track.">
        <div className="flex flex-col items-center rounded-2xl border border-border bg-card p-8 text-center shadow-card">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-soft text-danger-text">
            <AlertCircle className="h-7 w-7" />
          </span>
          <p className="mt-4 text-[15px] text-muted-foreground">{error}</p>
          <Button asChild className="mt-6 w-full">
            <Link to="/sign-in">Back to sign in</Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-5">
      <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-teal-600 border-t-transparent" />
      <p className="mt-4 text-sm font-medium text-muted-foreground">Finishing sign-in…</p>
    </div>
  );
}
