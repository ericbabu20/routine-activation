// Records product analytics events (PRD §30). Never store sensitive free-text
// (e.g. AI chat content) in `detail`. Failures here must never break a request.
import { admin } from "../supabase.js";

export async function logEvent(userId, name, detail = null) {
  if (!admin) return;
  try {
    await admin.from("analytics_events").insert({
      user_id: userId ?? null,
      name,
      detail: detail === null ? null : typeof detail === "string" ? { note: detail } : detail,
    });
  } catch (err) {
    // Analytics is best-effort; log and continue.
    console.warn("logEvent failed:", err.message);
  }
}
