// Local access-hardware simulator (dev tooling only — PRD §29 forbids a
// user-facing simulation UI). Signs and posts an access event exactly as a real
// turnstile would, so you can exercise entry/exit + visit tracking end-to-end.
//
// Usage:
//   1. In the app, open the Pass screen and copy the current token, OR
//      call POST /api/pass/token with a Bearer session token.
//   2. node scripts/access-sim.js entry <token> [gymId]
//      node scripts/access-sim.js exit  <token> [gymId]
import "dotenv/config";
import crypto from "crypto";
import { TestAccessAdapter } from "../server/lib/accessProvider.js";

const [, , type, token, gymId] = process.argv;

if (!["entry", "exit"].includes(type) || !token) {
  console.error("\n  Usage: node scripts/access-sim.js <entry|exit> <token> [gymId]\n");
  process.exit(1);
}

const secret = process.env.ACCESS_WEBHOOK_SECRET;
if (!secret) {
  console.error("\n  ACCESS_WEBHOOK_SECRET is not set in .env\n");
  process.exit(1);
}

const baseUrl = `http://localhost:${process.env.PORT || 3001}`;
const adapter = new TestAccessAdapter(secret, baseUrl);

const event = {
  idempotency_key: crypto.randomUUID(),
  token,
  gym_id: gymId || null,
  type,
  device_id: "sim-turnstile-01",
  occurred_at: new Date().toISOString(),
};

const res = await adapter.send(event);
console.log(`\n  → ${type} @ ${baseUrl}`);
console.log(`  status: ${res.status}`);
console.log("  response:", JSON.stringify(res.json, null, 2), "\n");
process.exit(res.json?.ok ? 0 : 1);
