// Access-provider webhook (PRD §12). Called by physical entry hardware — NOT by
// the member's app. Every request must carry a valid HMAC signature. Events are
// idempotent (replayed events are ignored) and drive visit tracking.
import { Router } from "express";
import { admin } from "../supabase.js";
import { verifyWebhook } from "../lib/accessProvider.js";
import { logEvent } from "../lib/events.js";

const router = Router();

// Does the member have an active membership that covers this centre?
async function canEnterGym(userId, gymId) {
  const { data } = await admin
    .from("memberships")
    .select("status, home_gym_id, plan:membership_plans(includes_all_centres)")
    .eq("user_id", userId)
    .neq("status", "cancelled")
    .maybeSingle();
  if (!data || data.status !== "active") return { ok: false, reason: "no_active_membership" };
  if (data.plan?.includes_all_centres) return { ok: true };
  if (gymId && data.home_gym_id === gymId) return { ok: true };
  return { ok: false, reason: "centre_not_covered" };
}

router.post("/api/access/events", async (req, res) => {
  try {
    const secret = process.env.ACCESS_WEBHOOK_SECRET;
    const rawBody = req.rawBody ? req.rawBody.toString("utf8") : JSON.stringify(req.body || {});
    const verdict = verifyWebhook({
      rawBody,
      signature: req.headers["x-access-signature"],
      timestamp: req.headers["x-access-timestamp"],
      secret,
    });
    if (!verdict.ok) {
      return res.status(401).json({ error: "Invalid signature", reason: verdict.reason });
    }

    const { idempotency_key, token, gym_id, type, device_id, occurred_at } = req.body || {};
    if (!idempotency_key || !token || !type) {
      return res.status(400).json({ error: "Missing idempotency_key, token or type." });
    }
    if (!["entry", "exit"].includes(type)) {
      return res.status(400).json({ error: "type must be 'entry' or 'exit'." });
    }

    // Idempotency: a replayed event returns the original outcome without side effects.
    const { data: existing } = await admin
      .from("access_events")
      .select("result")
      .eq("idempotency_key", idempotency_key)
      .maybeSingle();
    if (existing) return res.json({ ok: existing.result === "granted", result: existing.result, deduped: true });

    const record = async (result, userId, tokenId) => {
      await admin.from("access_events").insert({
        idempotency_key,
        user_id: userId || null,
        gym_id: gym_id || null,
        token_id: tokenId || null,
        type,
        result,
        device_id: device_id || null,
        occurred_at: occurred_at || new Date().toISOString(),
      });
    };

    // Resolve & validate the token.
    const { data: tok } = await admin
      .from("qr_access_tokens")
      .select("id, user_id, expires_at, used_at")
      .eq("token", token)
      .maybeSingle();

    if (!tok) {
      await record("denied", null, null);
      return res.json({ ok: false, result: "denied", reason: "invalid_token" });
    }
    if (tok.used_at) {
      await record("denied", tok.user_id, tok.id);
      return res.json({ ok: false, result: "denied", reason: "token_reused" });
    }
    if (new Date(tok.expires_at).getTime() < Date.now()) {
      await record("denied", tok.user_id, tok.id);
      return res.json({ ok: false, result: "denied", reason: "token_expired" });
    }

    // Single-use: consume the token.
    await admin.from("qr_access_tokens").update({ used_at: new Date().toISOString() }).eq("id", tok.id);
    const userId = tok.user_id;

    if (type === "entry") {
      const gate = await canEnterGym(userId, gym_id);
      if (!gate.ok) {
        await record("denied", userId, tok.id);
        return res.json({ ok: false, result: "denied", reason: gate.reason });
      }
      // Open a visit. If one is already open, the unique index blocks a second;
      // we treat that as success (already inside).
      await admin.from("visits").insert({ user_id: userId, gym_id, status: "active" });
      await record("granted", userId, tok.id);
      await logEvent(userId, "visit_entry", { gym_id });
      return res.json({ ok: true, result: "granted" });
    }

    // exit — close the open visit and compute duration.
    const { data: visit } = await admin
      .from("visits")
      .select("id, check_in_at")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    if (visit) {
      const checkout = new Date();
      const durationMin = Math.max(1, Math.round((checkout - new Date(visit.check_in_at)) / 60000));
      await admin
        .from("visits")
        .update({ check_out_at: checkout.toISOString(), duration_min: durationMin, status: "completed" })
        .eq("id", visit.id);
    }
    await record("granted", userId, tok.id);
    await logEvent(userId, "visit_exit", { gym_id });
    return res.json({ ok: true, result: "granted", closed: Boolean(visit) });
  } catch (err) {
    console.error("POST /api/access/events failed", err);
    res.status(500).json({ error: "Could not process access event." });
  }
});

export default router;
