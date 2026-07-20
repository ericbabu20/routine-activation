// Express middleware that protects API routes.
//
// It reads the Bearer access token, verifies it with Supabase, and attaches the
// resolved member to req.user. Routes must use req.user.id as the identity —
// they must NEVER trust a user id from the request body or query (PRD §6, §23).
import { getUserFromToken, bearerFromRequest } from "../supabase.js";

export async function requireAuth(req, res, next) {
  try {
    const token = bearerFromRequest(req);
    if (!token) {
      return res.status(401).json({ error: "Please sign in to continue." });
    }
    const user = await getUserFromToken(token);
    if (!user) {
      return res.status(401).json({ error: "Your session has expired. Please sign in again." });
    }
    req.user = user;      // authoritative member identity
    req.accessToken = token;
    next();
  } catch (err) {
    console.error("requireAuth failed", err);
    res.status(500).json({ error: "Could not verify your session." });
  }
}
