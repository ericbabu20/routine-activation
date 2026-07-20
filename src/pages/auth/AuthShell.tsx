import type { ReactNode } from "react";
import { BrandMark } from "@/components/Brand";

/** Centred, mobile-first shell used by every authentication screen. */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-10">
      <div className="flex items-center">
        <BrandMark />
      </div>

      <div className="mt-10">
        <h1 className="text-3xl font-extrabold leading-tight text-navy-700">{title}</h1>
        {subtitle && <p className="mt-2 text-[15px] text-muted-foreground">{subtitle}</p>}
      </div>

      <div className="mt-7 animate-fade-in">{children}</div>

      {footer && <div className="mt-auto pt-8 text-center text-sm text-muted-foreground">{footer}</div>}
    </div>
  );
}
