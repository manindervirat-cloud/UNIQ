"use client";

import { Button } from "@/components/ui/Button";

/** Route-level error boundary — nothing the student entered is lost. */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="panel mx-auto mt-16 max-w-md p-10 text-center">
      <p className="font-serif text-4xl" aria-hidden>
        ⚙️
      </p>
      <h2 className="mt-3 font-serif text-2xl font-semibold">
        That didn&apos;t work — but nothing was lost
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        Everything you entered is still saved. Try again, or head back a page.
      </p>
      <Button variant="primary" className="mt-6" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
