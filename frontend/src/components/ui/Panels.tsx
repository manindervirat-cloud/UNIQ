import { cn } from "@/lib/utils";
import { AlertOctagon, BadgeCheck, Lightbulb, ListChecks } from "lucide-react";

/** Blocker banner — a left-railed editorial notice, not a glowing alert. */
export function DangerAlert({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-red/25 bg-red-wash shadow-card">
      <div className="flex gap-4 p-5">
        <AlertOctagon className="mt-0.5 h-6 w-6 flex-none text-red" aria-hidden />
        <div>
          <p className="font-serif text-lg font-semibold text-red">{title}</p>
          <div className="mt-1 text-sm leading-relaxed text-ink-soft">{children}</div>
        </div>
      </div>
    </div>
  );
}

/** Quiet informational note. */
export function Hint({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-2 flex items-start gap-2.5 rounded-xl bg-blue-wash px-4 py-3 text-sm text-blue-deep">
      <Lightbulb className="mt-0.5 h-4 w-4 flex-none" aria-hidden />
      <span>{children}</span>
    </div>
  );
}

/** Amber caution. */
export function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-3 rounded-xl border border-amber/25 bg-amber-wash px-4 py-3 text-sm leading-relaxed text-amber">
      {children}
    </div>
  );
}

/** The counselor's letter — glass panel with a glowing accent rail. */
export function AnalysisCard({
  title,
  foot,
  children,
}: {
  title: string;
  foot?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel relative animate-rise overflow-hidden p-7 sm:p-8">
      <span
        className="absolute inset-y-0 left-0 w-1"
        style={{ background: "linear-gradient(180deg, #6366f1, #06b6d4)" }}
        aria-hidden
      />
      <header className="mb-3 flex items-center gap-2.5">
        <BadgeCheck className="h-5 w-5 text-blue-deep" aria-hidden />
        <h2 className="grad-text font-serif text-2xl font-semibold">{title}</h2>
      </header>
      <div className="text-[15px] leading-[1.8] text-ink-soft">{children}</div>
      {foot && <p className="mt-4 border-t border-line pt-3 text-xs text-ink-faint">{foot}</p>}
    </section>
  );
}

/** Checklist-style insight panel (strengths / verify). */
export function InsightPanel({
  tone,
  title,
  points,
  empty,
}: {
  tone: "green" | "amber";
  title: string;
  points: string[];
  empty: string;
}) {
  const green = tone === "green";
  return (
    <div className={cn("panel h-full p-5", green ? "!border-green/25" : "!border-amber/25")}>
      <p className={cn("mb-3 flex items-center gap-2 font-serif text-base font-semibold", green ? "text-green" : "text-amber")}>
        <ListChecks className="h-4 w-4" aria-hidden /> {title}
      </p>
      <ul className="space-y-2.5">
        {(points.length ? points : [empty]).map((p, i) => (
          <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-ink-soft">
            <span className={cn("mt-[7px] h-1.5 w-1.5 flex-none rounded-full", green ? "bg-green" : "bg-amber")} aria-hidden />
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}
