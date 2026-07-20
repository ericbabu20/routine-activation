import { Link } from "react-router-dom";
import { Dumbbell, HeartPulse, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/Brand";

const HIGHLIGHTS = [
  { icon: Dumbbell, text: "Build a realistic 45-day routine" },
  { icon: RefreshCw, text: "Recover from a missed session without guilt" },
  { icon: HeartPulse, text: "A calmer way to stay consistent" },
];

export default function Landing() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-10">
      <div className="flex items-center">
        <BrandMark />
      </div>

      <div className="mt-16">
        <h1 className="text-[40px] font-extrabold leading-[1.05] tracking-tight text-navy-700">
          Your routine can survive an imperfect week.
        </h1>
        <p className="mt-4 text-[16px] leading-relaxed text-muted-foreground">
          A calm, mobile-first way to build momentum in your first 45 days — and pick things back
          up whenever life gets in the way.
        </p>
      </div>

      <ul className="mt-9 space-y-3">
        {HIGHLIGHTS.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
              <Icon className="h-5 w-5" />
            </span>
            <span className="text-[15px] font-medium text-navy-700">{text}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto space-y-3 pt-10">
        <Button asChild size="lg" className="w-full">
          <Link to="/sign-up">Create your account</Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="w-full">
          <Link to="/sign-in">I already have an account</Link>
        </Button>
      </div>
    </div>
  );
}
