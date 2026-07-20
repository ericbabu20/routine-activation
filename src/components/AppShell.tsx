import type { ReactNode } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { Home, Compass, QrCode, Activity as ActivityIcon, User, Sparkles, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Tab {
  to: string;
  label: string;
  icon: LucideIcon;
  central?: boolean;
}

const TABS: Tab[] = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/pass", label: "Pass", icon: QrCode, central: true },
  { to: "/activity", label: "Activity", icon: ActivityIcon },
  { to: "/profile", label: "Profile", icon: User },
];

/** Authenticated app shell: scrollable content + fixed 5-tab bottom navigation. */
export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();

  return (
    <div className="mx-auto min-h-dvh w-full max-w-md bg-background">
      <main className="px-5 pb-28 pt-6">{children}</main>

      {/* Persistent Routine Assistant button (PRD §25). */}
      <Link
        to="/assistant"
        aria-label="Open Routine Assistant"
        className="fixed bottom-24 right-[max(1rem,calc(50%-13rem))] z-40 flex h-12 w-12 items-center justify-center rounded-full bg-purple-600 text-white shadow-card-hover transition-transform active:scale-95"
      >
        <Sparkles className="h-5 w-5" />
      </Link>

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-border bg-white/95 backdrop-blur"
      >
        <ul className="grid grid-cols-5 items-end px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5">
          {TABS.map(({ to, label, icon: Icon, central }) => {
            const active = pathname.startsWith(to);
            if (central) {
              return (
                <li key={to} className="flex justify-center">
                  <NavLink
                    to={to}
                    aria-label={label}
                    className="group -mt-6 flex flex-col items-center gap-1"
                  >
                    <span
                      className={cn(
                        "flex h-14 w-14 items-center justify-center rounded-2xl shadow-card-hover transition-transform group-active:scale-95",
                        active ? "bg-teal-700 text-white" : "bg-teal-600 text-white"
                      )}
                    >
                      <Icon className="h-6 w-6" strokeWidth={2.2} />
                    </span>
                    <span className="text-[11px] font-semibold text-navy-700">{label}</span>
                  </NavLink>
                </li>
              );
            }
            return (
              <li key={to}>
                <NavLink
                  to={to}
                  aria-label={label}
                  className="flex min-h-[44px] flex-col items-center justify-center gap-1 py-1"
                >
                  <Icon
                    className={cn("h-6 w-6 transition-colors", active ? "text-teal-700" : "text-muted-foreground")}
                    strokeWidth={active ? 2.4 : 2}
                  />
                  <span
                    className={cn(
                      "text-[11px] font-medium transition-colors",
                      active ? "text-teal-700" : "text-muted-foreground"
                    )}
                  >
                    {label}
                  </span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
