import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
  {
    variants: {
      variant: {
        neutral: "border-border bg-muted text-muted-foreground",
        navy: "border-navy-100 bg-navy-50 text-navy-700",
        teal: "border-teal-100 bg-teal-50 text-teal-700",
        orange: "border-orange-100 bg-orange-50 text-orange-600",
        magenta: "border-magenta-100 bg-magenta-50 text-magenta-600",
        success: "border-success-border bg-success-soft text-success-text",
        recovery: "border-recovery-border bg-recovery-soft text-recovery-text",
        danger: "border-danger-border bg-danger-soft text-danger-text",
      },
    },
    defaultVariants: { variant: "neutral" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
