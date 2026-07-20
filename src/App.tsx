import { Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./lib/auth";
import { AppShell } from "./components/AppShell";
import { LoadingScreen } from "./components/states";

import Landing from "./pages/auth/Landing";
import SignIn from "./pages/auth/SignIn";
import SignUp from "./pages/auth/SignUp";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import Callback from "./pages/auth/Callback";

import Home from "./pages/Home";
import Explore from "./pages/Explore";
import Pass from "./pages/Pass";
import Activity from "./pages/Activity";
import Profile from "./pages/Profile";
import Onboarding from "./pages/Onboarding";
import Membership from "./pages/Membership";
import Assistant from "./pages/Assistant";
import AiSettings from "./pages/settings/AiSettings";
import Workouts from "./pages/workouts/Workouts";
import WorkoutDetail from "./pages/workouts/WorkoutDetail";
import Session from "./pages/workouts/Session";
import Routine from "./pages/Routine";
import Nutrition from "./pages/Nutrition";
import Buddy from "./pages/Buddy";

function FullLoading() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md items-center justify-center px-5">
      <LoadingScreen />
    </div>
  );
}

/** Requires an authenticated session; wraps children in the 5-tab shell.
 *  Redirects to onboarding until it's complete (unless requireOnboarding=false). */
function Protected({
  children,
  shell = true,
  requireOnboarding = true,
}: {
  children: ReactNode;
  shell?: boolean;
  requireOnboarding?: boolean;
}) {
  const { status, profileLoaded, onboardingComplete } = useAuth();
  if (status === "loading") return <FullLoading />;
  if (status === "signedOut") return <Navigate to="/" replace />;
  if (!profileLoaded) return <FullLoading />;
  if (requireOnboarding && !onboardingComplete) return <Navigate to="/onboarding" replace />;
  return shell ? <AppShell>{children}</AppShell> : <>{children}</>;
}

/** Public routes redirect INTO the app when already signed in. */
function PublicOnly({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === "loading") return <FullLoading />;
  if (status === "signedIn") return <Navigate to="/home" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      {/* Public / auth */}
      <Route path="/" element={<PublicOnly><Landing /></PublicOnly>} />
      <Route path="/sign-in" element={<PublicOnly><SignIn /></PublicOnly>} />
      <Route path="/sign-up" element={<PublicOnly><SignUp /></PublicOnly>} />
      <Route path="/forgot-password" element={<PublicOnly><ForgotPassword /></PublicOnly>} />
      {/* Reset can be reached while a temporary recovery session is active. */}
      <Route path="/reset-password" element={<ResetPassword />} />
      {/* OAuth return URL — must be outside PublicOnly so the session can settle. */}
      <Route path="/auth/callback" element={<Callback />} />

      {/* Authenticated */}
      <Route path="/home" element={<Protected><Home /></Protected>} />
      <Route path="/explore" element={<Protected><Explore /></Protected>} />
      <Route path="/pass" element={<Protected><Pass /></Protected>} />
      <Route path="/activity" element={<Protected><Activity /></Protected>} />
      <Route path="/profile" element={<Protected><Profile /></Protected>} />
      <Route path="/membership" element={<Protected shell={false}><Membership /></Protected>} />
      <Route path="/buddy" element={<Protected shell={false}><Buddy /></Protected>} />
      <Route path="/routine" element={<Protected><Routine /></Protected>} />
      <Route path="/nutrition" element={<Protected><Nutrition /></Protected>} />
      <Route path="/workouts" element={<Protected><Workouts /></Protected>} />
      <Route path="/workouts/:id" element={<Protected shell={false}><WorkoutDetail /></Protected>} />
      <Route path="/session/:id" element={<Protected shell={false}><Session /></Protected>} />
      <Route path="/assistant" element={<Protected shell={false}><Assistant /></Protected>} />
      <Route path="/settings/ai" element={<Protected shell={false}><AiSettings /></Protected>} />
      <Route path="/onboarding" element={<Protected shell={false} requireOnboarding={false}><Onboarding /></Protected>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
