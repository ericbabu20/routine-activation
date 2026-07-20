// Server-side Supabase clients.
//
//  - admin:   uses the SECRET key; bypasses row-level security. Every query MUST
//             still apply an explicit ownership filter (e.g. .eq('user_id', userId)).
//  - authFor: builds a client scoped to a member's access token, so RLS applies
//             as that member (used for verifying identity).
//
// Member identity is ALWAYS resolved from the verified access token on the
// server — never from a user id supplied in the request body (PRD §6, §23).
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SECRET_KEY) {
  console.warn(
    "\n  [supabase] Missing SUPABASE_URL or SUPABASE_SECRET_KEY in .env — " +
      "auth and data features will not work until these are set.\n"
  );
}

// Privileged client (service role / secret). Never send this to the browser.
export const admin =
  SUPABASE_URL && SECRET_KEY
    ? createClient(SUPABASE_URL, SECRET_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

/**
 * Resolve the authenticated member from a Bearer access token.
 * Returns the Supabase user (with .id) or null if the token is missing/invalid.
 */
export async function getUserFromToken(accessToken) {
  if (!admin || !accessToken) return null;
  const { data, error } = await admin.auth.getUser(accessToken);
  if (error || !data?.user) return null;
  return data.user;
}

/** Extract a Bearer token from an Express request's Authorization header. */
export function bearerFromRequest(req) {
  const header = req.headers?.authorization || "";
  const [scheme, token] = header.split(" ");
  return scheme === "Bearer" && token ? token : null;
}
