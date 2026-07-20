// Browser-side Supabase client — used ONLY for authentication (sign up / sign in
// / sign out / password reset) and to hold the member's session. All member DATA
// is fetched from our own backend, which re-verifies the session server-side.
//
// The publishable key is safe to expose in the browser.
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

if (!url || !key) {
  // Surfaced clearly in the console during development.
  console.error(
    "[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. " +
      "Copy .env.example to .env and fill in your Supabase values."
  );
}

export const supabase = createClient(url ?? "", key ?? "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce",
  },
});
