// cult.fit Routine Assistant (PRD §21–25). All Gemini traffic is server-side.
// The member is authenticated first; their id comes from the session and any id
// in the chat text is ignored. Personal data is only reachable through the
// deterministic, ownership-safe tools in aiTools.js. RAG supplies approved
// unstructured content with source labels. History is stored only with consent.
import { Router } from "express";
import { admin } from "../supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { logEvent } from "../lib/events.js";
import { isConfigured, chatModel, generateTurn, QuotaError } from "../lib/gemini.js";
import { toolDeclarations, runTool } from "../lib/aiTools.js";
import { retrieve, sourceLabels } from "../lib/rag.js";

const router = Router();

// ---- Simple per-member rate limit (PRD §22) --------------------------------
const RATE_MAX = Number(process.env.AI_RATE_MAX || 15);
const RATE_WINDOW_MS = Number(process.env.AI_RATE_WINDOW_MS || 60000);
const buckets = new Map();
function rateLimited(userId) {
  const now = Date.now();
  const b = buckets.get(userId);
  if (!b || now > b.resetAt) {
    buckets.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  b.count += 1;
  return b.count > RATE_MAX;
}

const SYSTEM_PROMPT = `You are the "cult.fit Routine Assistant", a warm, encouraging fitness companion inside an independent, cult.fit-INSPIRED membership app (a product-management case study — never claim to be an official cult.fit product).

Your job is to help the member understand their next workout, schedule, bookings, 45-day progress, remaining workouts, active weeks, recent activity, visit summary, suitable approved workout options, and recovery choices.

Rules:
- Use the provided tools to fetch the member's real, live data before answering questions about their account, schedule, bookings, visits or progress. Never invent this data.
- For how-tos, policies, exercise/equipment guidance and FAQs, rely on the approved content provided to you; if you don't have it, say so plainly.
- Be supportive and non-judgemental. Never use guilt, shame, streak-pressure or aggressive language. A missed workout is normal and recoverable — progress is banked, never reset.
- You are NOT a medical professional. If the member mentions pain, injury or feeling unwell, advise them to stop and consult a qualified professional. Do not give medical or nutrition-diagnosis advice.
- Keep answers concise, friendly and practical. Prefer short paragraphs or tight bullet points.
- If asked for something you cannot access or that is out of scope, say so honestly and suggest what you can help with.`;

function mapHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .slice(-10)
    .filter((m) => m && typeof m.content === "string" && (m.role === "user" || m.role === "assistant"))
    .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
}

// ---- Status (is the assistant configured?) ---------------------------------
router.get("/api/ai/status", requireAuth, async (req, res) => {
  const { data: consent } = await admin
    .from("ai_consent")
    .select("mode, retain_history")
    .eq("user_id", req.user.id)
    .maybeSingle();
  res.json({
    configured: isConfigured(),
    model: chatModel(),
    mode: consent?.mode || "disabled",
    retain_history: consent?.retain_history || false,
  });
});

// ---- Consent (view / update / revoke) --------------------------------------
router.get("/api/ai/consent", requireAuth, async (req, res) => {
  const { data } = await admin
    .from("ai_consent")
    .select("mode, retain_history, consented_at, revoked_at")
    .eq("user_id", req.user.id)
    .maybeSingle();
  res.json({ consent: data || { mode: "disabled", retain_history: false } });
});

router.patch("/api/ai/consent", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { mode, retain_history } = req.body || {};
    const patch = { user_id: userId, updated_at: new Date().toISOString() };
    if (mode && ["personalised", "faq_only", "disabled"].includes(mode)) {
      patch.mode = mode;
      patch.consented_at = mode === "disabled" ? null : new Date().toISOString();
      patch.revoked_at = mode === "disabled" ? new Date().toISOString() : null;
    }
    if (typeof retain_history === "boolean") patch.retain_history = retain_history;

    await admin.from("ai_consent").upsert(patch);
    // If the member turns off history retention, delete stored messages.
    if (retain_history === false) await admin.from("ai_messages").delete().eq("user_id", userId);
    await logEvent(userId, "ai_consent_updated", { mode: patch.mode });
    res.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/ai/consent failed", err);
    res.status(500).json({ error: "We couldn't update your AI settings." });
  }
});

// ---- History (only meaningful when retain_history is on) -------------------
router.get("/api/ai/history", requireAuth, async (req, res) => {
  const { data } = await admin
    .from("ai_messages")
    .select("id, role, content, sources, feedback, created_at")
    .eq("user_id", req.user.id)
    .order("created_at", { ascending: true })
    .limit(100);
  res.json({ messages: data || [] });
});

router.delete("/api/ai/history", requireAuth, async (req, res) => {
  await admin.from("ai_messages").delete().eq("user_id", req.user.id);
  await logEvent(req.user.id, "ai_history_cleared");
  res.json({ ok: true });
});

// ---- Feedback on an assistant message --------------------------------------
router.post("/api/ai/feedback", requireAuth, async (req, res) => {
  const { message_id, value } = req.body || {};
  if (!message_id || ![1, -1, 0].includes(value)) return res.status(400).json({ error: "Invalid feedback." });
  await admin
    .from("ai_messages")
    .update({ feedback: value === 0 ? null : value })
    .eq("id", message_id)
    .eq("user_id", req.user.id); // ownership
  res.json({ ok: true });
});

// ---- Chat ------------------------------------------------------------------
router.post("/api/ai/chat", requireAuth, async (req, res) => {
  const userId = req.user.id;
  try {
    const message = (req.body?.message || "").toString().trim();
    if (!message) return res.status(400).json({ error: "Please type a message." });
    if (message.length > 2000) return res.status(400).json({ error: "That message is a bit long — please shorten it." });

    // Consent gate.
    const { data: consent } = await admin
      .from("ai_consent")
      .select("mode, retain_history")
      .eq("user_id", userId)
      .maybeSingle();
    const mode = consent?.mode || "disabled";
    if (mode === "disabled") {
      return res.status(403).json({ error: "The assistant is turned off. Enable it in Profile → AI settings.", code: "ai_disabled" });
    }
    if (!isConfigured()) {
      return res.status(503).json({ error: "The assistant isn't set up yet. Add a Gemini API key to enable it.", code: "not_configured" });
    }
    if (rateLimited(userId)) {
      return res.status(429).json({ error: "You're sending messages quickly — please wait a moment and try again." });
    }

    // Personalised mode gets the member-data tools; FAQ-only mode gets search only.
    const personalTools = new Set([
      "get_member_profile", "get_membership_summary", "get_current_routine", "get_routine_progress",
      "get_upcoming_schedule", "get_upcoming_bookings", "get_recent_workouts", "get_visit_summary",
      "get_notification_preferences",
    ]);
    const tools = mode === "personalised"
      ? toolDeclarations
      : toolDeclarations.filter((t) => !personalTools.has(t.name));

    // Upfront RAG grounding + source collection.
    const ragChunks = await retrieve(message, userId, { limit: 4 });
    const sources = sourceLabels(ragChunks);
    let systemInstruction = SYSTEM_PROMPT;
    if (mode === "faq_only") {
      systemInstruction += `\n\nThe member has chosen NON-PERSONALISED mode. Do NOT reference their personal account data; answer generally using approved content.`;
    }
    if (ragChunks.length) {
      const ctx = ragChunks.map((c, i) => `[${i + 1}] (${c.source} — ${c.title})\n${c.content}`).join("\n\n");
      systemInstruction += `\n\nApproved reference content you may use (cite by title where relevant):\n${ctx}`;
    }

    const contents = [...mapHistory(req.body?.history), { role: "user", parts: [{ text: message }] }];

    // Function-calling loop.
    let answer = "";
    let usage = null;
    for (let i = 0; i < 6; i++) {
      const resp = await generateTurn({ contents, tools, systemInstruction });
      const calls = resp.functionCalls || [];
      usage = resp.usageMetadata || usage;
      if (!calls.length) {
        answer = (resp.text || "").trim();
        break;
      }
      const modelContent = resp.candidates?.[0]?.content;
      if (modelContent) contents.push(modelContent);
      const parts = [];
      for (const call of calls) {
        const result = await runTool(call.name, userId, call.args);
        if ((call.name === "search_help_content" || call.name === "search_workout_library") && Array.isArray(result.results)) {
          for (const r of result.results) sources.push({ source: r.source, title: r.title });
        }
        parts.push({ functionResponse: { name: call.name, response: result } });
      }
      contents.push({ role: "user", parts });
    }

    if (!answer) answer = "I'm sorry — I couldn't put together an answer just now. Please try rephrasing.";

    // De-duplicate sources.
    const seen = new Set();
    const finalSources = sources.filter((s) => {
      const k = `${s.source}:${s.title}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    // Cost monitoring: record token usage only (never chat content) — PRD §22, §30.
    await logEvent(userId, "ai_chat", {
      model: chatModel(),
      mode,
      prompt_tokens: usage?.promptTokenCount ?? null,
      response_tokens: usage?.candidatesTokenCount ?? null,
      total_tokens: usage?.totalTokenCount ?? null,
    });

    // Persist history only with consent.
    let messageId = null;
    if (consent?.retain_history) {
      await admin.from("ai_messages").insert({ user_id: userId, role: "user", content: message });
      const { data: inserted } = await admin
        .from("ai_messages")
        .insert({ user_id: userId, role: "assistant", content: answer, sources: finalSources })
        .select("id")
        .single();
      messageId = inserted?.id || null;
    }

    res.json({ answer, sources: finalSources, message_id: messageId });
  } catch (err) {
    if (err instanceof QuotaError) {
      return res.status(429).json({ error: "The assistant is busy right now (quota reached). Please try again shortly." });
    }
    console.error("POST /api/ai/chat failed", err);
    res.status(500).json({ error: "The assistant ran into a problem. Please try again." });
  }
});

export default router;
