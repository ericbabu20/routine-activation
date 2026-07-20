import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, Trash2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { data, type AiStatus } from "@/lib/data";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Mode = "personalised" | "faq_only" | "disabled";

const MODES: { id: Mode; label: string; body: string }[] = [
  { id: "personalised", label: "Personalised", body: "The assistant can use your schedule, bookings, visits and progress to give tailored answers." },
  { id: "faq_only", label: "General (non-personalised)", body: "The assistant answers general questions from approved help content only — it won't use your personal data." },
  { id: "disabled", label: "Off", body: "The assistant is turned off and can't be used." },
];

export default function AiSettings() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [mode, setMode] = useState<Mode>("disabled");
  const [retain, setRetain] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    data.aiStatus().then((s) => {
      setStatus(s);
      setMode(s.mode);
      setRetain(s.retain_history);
    }).catch(() => toast.error("Couldn't load AI settings."));
  }, []);

  async function changeMode(next: Mode) {
    setMode(next);
    setSaving(true);
    try {
      await data.updateAiConsent({ mode: next });
      toast.success("AI settings updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  async function changeRetain(next: boolean) {
    setRetain(next);
    setSaving(true);
    try {
      await data.updateAiConsent({ retain_history: next });
      toast.success(next ? "Chat history will be saved" : "Chat history saving turned off");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  async function clearHistory() {
    try {
      await data.clearAiHistory();
      toast.success("Conversation history deleted");
    } catch {
      toast.error("Couldn't clear history.");
    }
  }

  return (
    <div className="mx-auto min-h-dvh w-full max-w-md bg-background">
      <header className="flex items-center gap-2 border-b border-border bg-white px-4 py-3">
        <button aria-label="Back" onClick={() => navigate("/profile")} className="rounded-lg p-1 text-navy-700 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-sm font-bold text-navy-700">Privacy & AI settings</h1>
      </header>

      <div className="space-y-6 px-5 py-6">
        <div className="flex items-start gap-3 rounded-2xl bg-purple-50 p-4">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-purple-600" />
          <div>
            <p className="text-sm font-bold text-navy-700">cult.fit Routine Assistant</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              A Gemini-powered helper for your routine. Personalisation is optional, you can switch it off
              any time, and you control whether your chat history is saved. It is not a medical service.
            </p>
          </div>
        </div>

        {status && !status.configured && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            The assistant isn't fully set up on the server yet (no AI key), so it can't answer until that's added.
          </div>
        )}

        {/* Mode */}
        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">What the assistant can use</h2>
          <div className="space-y-2">
            {MODES.map((m) => (
              <button
                key={m.id}
                disabled={saving}
                onClick={() => changeMode(m.id)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition",
                  mode === m.id ? "border-teal-600 bg-teal-50/50 ring-1 ring-teal-600" : "border-border bg-card"
                )}
              >
                <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                  mode === m.id ? "border-teal-600" : "border-muted-foreground/40")}>
                  {mode === m.id && <span className="h-2.5 w-2.5 rounded-full bg-teal-600" />}
                </span>
                <span>
                  <span className="block text-sm font-semibold text-navy-700">{m.label}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{m.body}</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* History */}
        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Conversation history</h2>
          <div className="rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="text-sm font-semibold text-navy-700">Save my chat history</p>
                <p className="mt-0.5 text-xs text-muted-foreground">When off, messages aren't stored and past chats are deleted.</p>
              </div>
              <Switch checked={retain} onCheckedChange={changeRetain} disabled={saving || mode === "disabled"} />
            </div>
            <div className="border-t border-border p-4">
              <Button variant="outline" className="w-full" onClick={clearHistory}>
                <Trash2 className="h-4 w-4" /> Delete conversation history
              </Button>
            </div>
          </div>
        </section>

        <p className="px-1 text-center text-xs leading-relaxed text-muted-foreground">
          Your data is only ever used for your own answers. The assistant retrieves the minimum needed and
          never shares one member's information with another.
        </p>
      </div>
    </div>
  );
}
