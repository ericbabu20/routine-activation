import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Send, Sparkles, Trash2, ThumbsUp, ThumbsDown, RotateCw, BookOpen, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { data, type AiMessage, type AiStatus } from "@/lib/data";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const STARTERS = [
  "What should I do today?",
  "Am I on track for my 45-day target?",
  "How many workouts do I have left?",
  "What class do I have next?",
  "I feel tired. What can I do instead?",
  "I missed yesterday. How should I recover?",
];

export default function Assistant() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [lastFailed, setLastFailed] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    data.aiStatus().then(async (s) => {
      setStatus(s);
      if (s.configured && s.mode !== "disabled" && s.retain_history) {
        try {
          setMessages(await data.aiHistory());
        } catch {
          /* ignore */
        }
      }
    }).catch(() => setStatus({ configured: false, model: "", mode: "disabled", retain_history: false }));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || sending) return;
    setInput("");
    setLastFailed(null);
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: "user", content: message }]);
    setSending(true);
    try {
      const res = await data.aiChat(message, history);
      setMessages((prev) => [
        ...prev,
        { id: res.message_id ?? undefined, role: "assistant", content: res.answer, sources: res.sources, feedback: null },
      ]);
    } catch (err) {
      setLastFailed(message);
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setMessages((prev) => [...prev, { role: "assistant", content: `⚠️ ${msg}`, sources: [] }]);
    } finally {
      setSending(false);
    }
  }

  async function clearConversation() {
    setMessages([]);
    try {
      await data.clearAiHistory();
    } catch {
      /* best effort */
    }
    toast.success("Conversation cleared");
  }

  async function rate(m: AiMessage, value: 1 | -1) {
    if (!m.id) return;
    const next = m.feedback === value ? 0 : value;
    setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, feedback: next === 0 ? null : next } : x)));
    try {
      await data.aiFeedback(m.id, next);
    } catch {
      /* best effort */
    }
  }

  // ---- Not-available states ----
  if (status && (!status.configured || status.mode === "disabled")) {
    const disabled = status.mode === "disabled";
    return (
      <Screen onBack={() => navigate(-1)} onClear={null}>
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <span className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-50 text-purple-600">
            <Sparkles className="h-7 w-7" />
          </span>
          <h2 className="text-lg font-bold text-navy-700">
            {disabled ? "The assistant is turned off" : "Assistant not set up yet"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {disabled
              ? "Turn on the Routine Assistant in Profile → AI settings to start chatting. You choose whether it can use your data."
              : "The assistant needs a Gemini API key on the server before it can answer. Once that's configured it'll appear here."}
          </p>
          {disabled && (
            <Button className="mt-5" onClick={() => navigate("/settings/ai")}>
              <ShieldCheck className="h-4 w-4" /> Open AI settings
            </Button>
          )}
        </div>
      </Screen>
    );
  }

  const empty = messages.length === 0;

  return (
    <Screen onBack={() => navigate(-1)} onClear={empty ? null : clearConversation}>
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {empty && (
          <div className="pt-4">
            <div className="mb-4 flex flex-col items-center text-center">
              <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-600">
                <Sparkles className="h-6 w-6" />
              </span>
              <h2 className="text-base font-bold text-navy-700">How can I help?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Ask about your schedule, progress, bookings or what to do next.
                {status?.mode === "faq_only" && " (Non-personalised mode — general answers only.)"}
              </p>
            </div>
            <div className="space-y-2">
              {STARTERS.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-left text-sm font-medium text-navy-700 shadow-card transition hover:shadow-card-hover"
                >
                  {q}
                  <Send className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={m.id || i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
              m.role === "user" ? "bg-teal-600 text-white" : "bg-mist text-navy-700")}>
              <p className="whitespace-pre-wrap">{m.content}</p>

              {m.role === "assistant" && m.sources && m.sources.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5 border-t border-black/5 pt-2">
                  {m.sources.map((s, si) => (
                    <span key={si} className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      <BookOpen className="h-3 w-3" /> {s.title}
                    </span>
                  ))}
                </div>
              )}

              {m.role === "assistant" && m.id && (
                <div className="mt-2 flex gap-2">
                  <button aria-label="Helpful" onClick={() => rate(m, 1)} className={cn("rounded-md p-1", m.feedback === 1 ? "text-teal-700" : "text-muted-foreground hover:text-navy-700")}>
                    <ThumbsUp className="h-3.5 w-3.5" />
                  </button>
                  <button aria-label="Not helpful" onClick={() => rate(m, -1)} className={cn("rounded-md p-1", m.feedback === -1 ? "text-red-600" : "text-muted-foreground hover:text-navy-700")}>
                    <ThumbsDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-mist px-4 py-3">
              <span className="flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.2s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.1s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60" />
              </span>
            </div>
          </div>
        )}

        {lastFailed && !sending && (
          <div className="flex justify-center">
            <Button variant="outline" size="sm" onClick={() => send(lastFailed)}>
              <RotateCw className="h-4 w-4" /> Retry
            </Button>
          </div>
        )}
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="border-t border-border bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            rows={1}
            placeholder="Ask the Routine Assistant…"
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-teal-500"
          />
          <Button type="submit" size="icon" className="h-11 w-11 shrink-0 rounded-2xl" disabled={sending || !input.trim()}>
            <Send className="h-5 w-5" />
          </Button>
        </div>
        <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
          Not medical advice. The assistant can make mistakes.
        </p>
      </form>
    </Screen>
  );
}

function Screen({ children, onBack, onClear }: { children: React.ReactNode; onBack: () => void; onClear: (() => void) | null }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background">
      <header className="flex items-center gap-2 border-b border-border bg-white px-4 py-3">
        <button aria-label="Back" onClick={onBack} className="rounded-lg p-1 text-navy-700 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex flex-1 items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <h1 className="text-sm font-bold leading-tight text-navy-700">Routine Assistant</h1>
            <p className="text-[11px] leading-tight text-muted-foreground">Here to help you move</p>
          </div>
        </div>
        {onClear && (
          <button aria-label="Clear conversation" onClick={onClear} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-navy-700">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </header>
      {children}
    </div>
  );
}
