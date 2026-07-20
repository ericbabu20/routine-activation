import { Dumbbell } from "lucide-react";
import { cn } from "@/lib/utils";

// A generic fitness mark — intentionally NOT the official cult.fit logo.
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 text-white shadow-sm",
        className
      )}
      aria-hidden="true"
    >
      <Dumbbell className="h-5 w-5" strokeWidth={2.4} />
    </span>
  );
}

export function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <BrandMark />
      <div className="leading-tight">
        <span className="text-base font-extrabold text-navy-700">Routine</span>
      </div>
    </div>
  );
}
