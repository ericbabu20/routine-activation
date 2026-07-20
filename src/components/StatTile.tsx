import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "navy" | "teal" | "success" | "recovery" | "orange";

const toneMap: Record<Tone, string> = {
  navy: "text-navy-700",
  teal: "text-teal-700",
  success: "text-success-text",
  recovery: "text-recovery-text",
  orange: "text-orange-600",
};

export function StatTile({
  label,
  value,
  sub,
  tone = "navy",
  icon,
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-white p-4 shadow-card sm:p-5",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <p className={cn("mt-2 text-2xl font-extrabold tabular-nums sm:text-3xl", toneMap[tone])}>
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
