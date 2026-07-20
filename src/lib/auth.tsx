import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { apiGet } from "./api";

export interface MemberProfile {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  fitness_experience: string | null;
  primary_goal: string | null;
  home_gym_id: string | null;
  onboarding_completed: boolean;
  created_at: string;
}

type AuthStatus = "loading" | "signedOut" | "signedIn";

interface AuthValue {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  profile: MemberProfile | null;
  profileLoaded: boolean;
  onboardingComplete: boolean;
  signUp: (email: string, password: string, name?: string) => Promise<{ error?: string; needsEmailConfirm?: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signInWithGoogle: () => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<{ error?: string }>;
  updatePassword: (password: string) => Promise<{ error?: string }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const { profile } = await apiGet<{ profile: MemberProfile }>("/api/me");
      setProfile(profile);
    } catch {
      setProfile(null);
    } finally {
      setProfileLoaded(true);
    }
  }, []);

  // Initial session + subscribe to auth changes.
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setStatus(data.session ? "signedIn" : "signedOut");
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setStatus(next ? "signedIn" : "signedOut");
      if (!next) {
        setProfile(null);
        setProfileLoaded(false);
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Load the member profile whenever we become signed in.
  useEffect(() => {
    if (status === "signedIn") loadProfile();
  }, [status, loadProfile]);

  const signUp = useCallback<AuthValue["signUp"]>(async (email, password, name) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: name ? { name } : undefined },
    });
    if (error) return { error: error.message };
    // If email confirmation is required, there is no session yet.
    return { needsEmailConfirm: !data.session };
  }, []);

  const signIn = useCallback<AuthValue["signIn"]>(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return {};
  }, []);

  const signInWithGoogle = useCallback<AuthValue["signInWithGoogle"]>(async () => {
    // Supabase redirects to Google, then back to redirectTo. The onAuthStateChange
    // listener picks up the session automatically when we return.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) return { error: error.message };
    return {};
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const sendPasswordReset = useCallback<AuthValue["sendPasswordReset"]>(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return { error: error.message };
    return {};
  }, []);

  const updatePassword = useCallback<AuthValue["updatePassword"]>(async (password) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: error.message };
    return {};
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      status,
      session,
      user: session?.user ?? null,
      profile,
      profileLoaded,
      onboardingComplete: Boolean(profile?.onboarding_completed),
      signUp,
      signIn,
      signInWithGoogle,
      signOut,
      sendPasswordReset,
      updatePassword,
      refreshProfile: loadProfile,
    }),
    [status, session, profile, profileLoaded, signUp, signIn, signInWithGoogle, signOut, sendPasswordReset, updatePassword, loadProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
