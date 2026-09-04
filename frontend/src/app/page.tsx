import { ProfileWizard } from "@/components/profile/ProfileWizard";
import { ShieldCheck, Scale, Wallet } from "lucide-react";

/**
 * Home — a split editorial landing: the promise on the left, the guided
 * wizard on the right. Nothing dashboard-like about it.
 */
export default function HomePage() {
  return (
    <div className="grid items-start gap-10 lg:grid-cols-[5fr,7fr]">
      <section className="lg:sticky lg:top-24">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-deep">
          Your study-abroad counselor
        </p>
        <h1 className="mt-3 font-serif text-[42px] font-semibold leading-[1.12] tracking-tight">
          Find universities that <span className="grad-text">genuinely fit you</span>
        </h1>
        <p className="mt-4 max-w-md text-[15px] leading-[1.8] text-ink-soft">
          Answer a few questions once. We check real admission requirements first, then rank every
          eligible university by how well it matches what you&apos;re looking for — and we&apos;ll
          tell you honestly when something doesn&apos;t add up.
        </p>
        <ul className="mt-8 space-y-4">
          {[
            {
              icon: <ShieldCheck className="h-5 w-5 text-green" aria-hidden />,
              title: "Eligibility before ranking",
              text: "Universities you can't get into never receive a score — you see why, and how to fix it.",
            },
            {
              icon: <Wallet className="h-5 w-5 text-amber" aria-hidden />,
              title: "Honest about money",
              text: "Over-budget options are labelled plainly, never dressed up as matches.",
            },
            {
              icon: <Scale className="h-5 w-5 text-blue-deep" aria-hidden />,
              title: "Every rank explained",
              text: "Eight weighted factors, visible on every card — no black-box scores.",
            },
          ].map((f) => (
            <li key={f.title} className="flex gap-3.5">
              <span className="mt-0.5 flex h-10 w-10 flex-none items-center justify-center rounded-xl border border-line bg-white/5 shadow-card backdrop-blur">
                {f.icon}
              </span>
              <div>
                <p className="font-serif text-[15px] font-semibold">{f.title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">{f.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <ProfileWizard />
    </div>
  );
}
