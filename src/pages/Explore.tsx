import { useState } from "react";
import { Building2, CalendarDays } from "lucide-react";
import { PageIntro } from "@/components/PageIntro";
import { cn } from "@/lib/utils";
import Centres from "./explore/Centres";
import Classes from "./explore/Classes";

const SEGMENTS = [
  { id: "centres", label: "Centres", icon: Building2 },
  { id: "classes", label: "Classes", icon: CalendarDays },
] as const;

type Segment = (typeof SEGMENTS)[number]["id"];

export default function Explore() {
  const [seg, setSeg] = useState<Segment>("centres");

  return (
    <div>
      <PageIntro title="Explore" subtitle="Find centres and book classes." />

      <div
        role="tablist"
        aria-label="Explore categories"
        className="mb-6 flex gap-1 overflow-x-auto rounded-xl bg-mist p-1 no-scrollbar"
      >
        {SEGMENTS.map(({ id, label }) => (
          <button
            key={id}
            role="tab"
            aria-selected={seg === id}
            onClick={() => setSeg(id)}
            className={cn(
              "min-h-[40px] flex-1 whitespace-nowrap rounded-lg px-3 text-sm font-semibold transition",
              seg === id ? "bg-white text-navy-700 shadow-sm" : "text-muted-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {seg === "centres" ? <Centres /> : <Classes />}
    </div>
  );
}
