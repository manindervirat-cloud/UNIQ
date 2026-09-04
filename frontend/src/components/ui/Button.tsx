"use client";

import { cn } from "@/lib/utils";
import { forwardRef } from "react";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "outline" | "soft" | "link";

const styles: Record<Variant, string> = {
  primary: "grad-primary rounded-full text-white disabled:opacity-50 disabled:shadow-none",
  outline:
    "rounded-full border border-line-strong bg-white/5 text-ink backdrop-blur transition-all hover:border-blue/60 hover:text-blue-deep hover:shadow-glow disabled:opacity-50",
  soft: "rounded-full bg-blue-wash text-blue-deep transition-all hover:bg-blue/25 hover:shadow-glow disabled:opacity-50",
  link: "rounded-md text-blue-deep underline-offset-4 hover:underline disabled:opacity-50",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "outline", loading, children, disabled, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex min-h-[44px] items-center justify-center gap-2 px-5 py-2 text-sm font-semibold active:scale-[0.97]",
        styles[variant],
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});
