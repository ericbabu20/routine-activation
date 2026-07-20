// Gemini access (PRD §22). The API key is read from a server-side env var, is
// never sent to the browser, never logged, and all traffic is routed through
// the backend. The model is configurable; calls have timeouts + bounded retries
// and surface quota errors cleanly. If no key is configured the assistant
// degrades gracefully (callers get isConfigured() === false).
import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.GEMINI_API_KEY || "";
const CHAT_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL || "gemini-embedding-001";
export const EMBED_DIM = 768;

const REQUEST_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 20000);
const MAX_RETRIES = Number(process.env.GEMINI_MAX_RETRIES || 2);

let client = null;
if (API_KEY) client = new GoogleGenAI({ apiKey: API_KEY });

export function isConfigured() {
  return Boolean(client);
}

export function chatModel() {
  return CHAT_MODEL;
}

class QuotaError extends Error {}
export { QuotaError };

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out`)), ms)),
  ]);
}

function isRetryable(err) {
  const status = err?.status || err?.code;
  const msg = String(err?.message || "");
  return status === 503 || status === 500 || /timed out|ECONNRESET|fetch failed/i.test(msg);
}

function isQuota(err) {
  const status = err?.status || err?.code;
  return status === 429 || /quota|rate limit|RESOURCE_EXHAUSTED/i.test(String(err?.message || ""));
}

async function callWithRetry(fn, label) {
  let lastErr;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await withTimeout(fn(), REQUEST_TIMEOUT_MS, label);
    } catch (err) {
      lastErr = err;
      if (isQuota(err)) throw new QuotaError("Gemini quota exceeded");
      if (!isRetryable(err) || attempt === MAX_RETRIES) break;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1))); // simple backoff
    }
  }
  throw lastErr;
}

/** Embed a single piece of text. Returns number[] (length EMBED_DIM) or null. */
export async function embedText(text) {
  if (!client || !text) return null;
  const res = await callWithRetry(
    () => client.models.embedContent({
      model: EMBED_MODEL,
      contents: text,
      config: { outputDimensionality: EMBED_DIM },
    }),
    "embedContent"
  );
  const values = res?.embeddings?.[0]?.values || res?.embedding?.values || null;
  return Array.isArray(values) ? values : null;
}

/**
 * One Gemini turn. `contents` is the running conversation (array of {role, parts}).
 * `tools` are function declarations. Returns the raw GenerateContentResponse so
 * the caller can inspect functionCalls / text / usageMetadata.
 */
export async function generateTurn({ contents, tools, systemInstruction }) {
  if (!client) throw new Error("Gemini is not configured");
  return callWithRetry(
    () =>
      client.models.generateContent({
        model: CHAT_MODEL,
        contents,
        config: {
          systemInstruction,
          temperature: 0.4,
          ...(tools ? { tools: [{ functionDeclarations: tools }] } : {}),
        },
      }),
    "generateContent"
  );
}
