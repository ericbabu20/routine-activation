import type { ReactNode } from "react";

/** Consistent large heading + optional subtitle for each primary screen. */
export function PageIntro({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="mb-5 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-[28px] font-extrabold leading-tight text-navy-700">{title}</h1>
        {subtitle && <p className="mt-1 text-[15px] text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

/** Friendly empty state with an optional primary action. */
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-10 text-center">
      {icon && (
        <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
          {icon}
        </span>
      )}
      <h3 className="text-base font-bold text-navy-700">{title}</h3>
      {body && <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-muted-foreground">{body}</p>}
      {action && <div className="mt-5 w-full max-w-xs">{action}</div>}
    </div>
  );
}
