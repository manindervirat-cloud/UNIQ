import { InsightPanel } from "@/components/ui/Panels";
import { cn } from "@/lib/utils";
import type { Roadmap } from "@/types/api";

const prioTone: Record<string, string> = {
  High: "tag-red",
  Medium: "tag-amber",
  Optional: "tag-neutral",
};

export function RoadmapPanel({ roadmap }: { roadmap: Roadmap }) {
  const tone =
    roadmap.probabilityLabel === "High"
      ? "tag-green"
      : roadmap.probabilityLabel === "Moderate"
        ? "tag-amber"
        : "tag-red";
  return (
    <div className="mt-6 space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("tag text-sm", tone)}>
          {roadmap.probabilityLabel} probability · ~{Math.round(roadmap.probabilityPercent)}%
        </span>
        {roadmap.projectedChancePercent > roadmap.probabilityPercent + 2 && (
          <span className="tag tag-green">
            Projected after high-priority actions: ~{Math.round(roadmap.projectedChancePercent)}%
          </span>
        )}
      </div>
      <p className="rounded-xl border-l-2 border-blue bg-blue-wash p-4 text-sm leading-relaxed text-ink-soft">
        {roadmap.summary}
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <InsightPanel tone="green" title="Current strengths" points={roadmap.strengths} empty="Add scores to see your strengths." />
        <InsightPanel tone="amber" title="Gaps to close" points={roadmap.gaps} empty="No blocking gaps found." />
      </div>
      <div>
        <p className="mb-2.5 font-serif text-base font-semibold">Your action roadmap, by priority</p>
        <ol className="space-y-2.5">
          {roadmap.items.map((item, i) => (
            <li key={i} className="flex items-start gap-3.5 well p-4">
              <span className={cn("tag mt-0.5 flex-none text-[10px] uppercase tracking-wider", prioTone[item.priority])}>
                {item.priority}
              </span>
              <div>
                <p className="text-sm font-bold">{item.area}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">{item.action}</p>
                <p className="mt-1 text-xs italic text-ink-faint">Expected impact: {item.impact}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <p className="text-xs text-ink-faint">{roadmap.disclaimer}</p>
    </div>
  );
}
