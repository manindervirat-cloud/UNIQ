import { cn } from "@/lib/utils";

/** Form field with a floating-feel label block and inline feedback. */
export function Field({
  label,
  icon,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  icon?: React.ReactNode;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("group block", className)}>
      <span className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-ink-soft transition-colors group-focus-within:text-blue-deep">
        {icon && <span className="text-ink-faint transition-colors group-focus-within:text-blue-deep">{icon}</span>}
        {label}
      </span>
      {children}
      {hint && !error && <span className="mt-1.5 block animate-rise text-xs font-medium text-green">{hint}</span>}
      {error && <span className="mt-1.5 block animate-rise text-xs font-medium text-amber">{error}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-line-strong bg-white/5 px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint backdrop-blur focus:border-blue focus:bg-white/[0.07] focus:outline-none focus:ring-2 focus:ring-blue/25 hover:border-blue/40 transition-all duration-200 appearance-none " +
  // custom chevron for selects (indigo, matches the accent)
  "[&:is(select)]:bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 fill=%22none%22><path d=%22M4 6l4 4 4-4%22 stroke=%22%23a5b4fc%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22/></svg>')] [&:is(select)]:bg-[right_0.9rem_center] [&:is(select)]:bg-no-repeat [&:is(select)]:pr-10";
