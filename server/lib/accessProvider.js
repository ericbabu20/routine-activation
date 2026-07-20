// AccessProvider abstraction (PRD §12).
//
// Physical entry hardware (turnstiles / door controllers) reports entry & exit
// events to our backend via a signed webhook. We never talk to the hardware
// directly; we only trust signed events. This module defines:
//
//   - signing / verification of webhook requests (HMAC-SHA256), and
//   - a TestAccessAdapter used ONLY by local dev tooling to simulate a turnstile.
//
// There is intentionally NO user-facing simulation UI (PRD §29): the test
// adapter is exercised by scripts/access-sim.js from a terminal.
import crypto from "crypto";

const REPLAY_WINDOW_SECONDS = 300; // reject events older than 5 minutes

/** Compute the canonical signature for a raw request body + timestamp. */
export function computeSignature(rawBody, timestamp, secret) {
  const payload = `${timestamp}.${rawBody}`;
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

/** Constant-time comparison of two hex signatures. */
function safeEqual(a, b) {
  const ba = Buffer.from(a || "", "utf8");
  const bb = Buffer.from(b || "", "utf8");
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/**
 * Verify an incoming webhook request.
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function verifyWebhook({ rawBody, signature, timestamp, secret }) {
  if (!secret) return { ok: false, reason: "server_not_configured" };
  if (!signature || !timestamp) return { ok: false, reason: "missing_signature" };

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return { ok: false, reason: "bad_timestamp" };
  const ageSeconds = Math.abs(Date.now() / 1000 - ts);
  if (ageSeconds > REPLAY_WINDOW_SECONDS) return { ok: false, reason: "stale" };

  const expected = computeSignature(rawBody, timestamp, secret);
  if (!safeEqual(expected, signature)) return { ok: false, reason: "bad_signature" };
  return { ok: true };
}

/**
 * Test adapter: builds a correctly-signed webhook request. For local dev only.
 * Real providers implement their own signing on their side.
 */
export class TestAccessAdapter {
  constructor(secret, baseUrl = "http://localhost:3001") {
    this.secret = secret;
    this.baseUrl = baseUrl;
  }

  build(event) {
    const body = JSON.stringify(event);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = computeSignature(body, timestamp, this.secret);
    return {
      url: `${this.baseUrl}/api/access/events`,
      body,
      headers: {
        "Content-Type": "application/json",
        "X-Access-Timestamp": timestamp,
        "X-Access-Signature": signature,
      },
    };
  }

  async send(event) {
    const req = this.build(event);
    const res = await fetch(req.url, { method: "POST", headers: req.headers, body: req.body });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, json };
  }
}
