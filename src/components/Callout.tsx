import type { ReactNode } from "react";
import { Info, HeartHandshake, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "info" | "recovery" | "success" | "error";

const styles: Record<Tone, { wrap: string; icon: typeof Info }> = {
  info: { wrap: "border-mist bg-white text-navy-700", icon: Info },
  recovery: { wrap: "border-recovery-border bg-recovery-soft text-recovery-text", icon: HeartHandshake },
  success: { wrap: "border-success-border bg-success-soft text-success-text", icon: CheckCircle2 },
  error: { wrap: "border-danger-border bg-danger-soft text-danger-text", icon: AlertCircle },
};

export function Callout({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const s = styles[tone];
  const Icon = s.icon;
  return (
    <div className={cn("flex gap-3 rounded-xl border p-4", s.wrap, className)} role="note">
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="space-y-1 text-sm">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="leading-relaxed opacity-90">{children}</div>}
      </div>
    </div>
  );
}
