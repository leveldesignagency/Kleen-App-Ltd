import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { customerAppHref } from "@/lib/customer-app-url";

const jobFlowHref = customerAppHref("/job-flow");

const TAGS = ["Vetted cleaners", "Book on demand", "Instant quotes"];

export default function AboutStorySection() {
  return (
    <section className="bg-white pb-4 pt-4 sm:pb-8 lg:pb-12">
      <div className="mx-auto grid max-w-screen-2xl items-center gap-10 lg:grid-cols-2 lg:gap-14">
        <div className="lg:py-4">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">
            Why we built KLEEN
          </p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-[2.5rem] lg:leading-tight">
            Reliable cleaners, available when you need them
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-slate-600">
            We saw a problem in the market: most people still can&apos;t easily access reliable
            cleaners — and booking one exactly when they need it is even harder. Word of mouth,
            endless phone calls, no-shows, and pricing you only discover at the end.
          </p>
          <p className="mt-4 text-lg leading-relaxed text-slate-600">
            KLEEN exists to fix that. We give everyone on-demand access to vetted professionals,
            with instant quotes, transparent pricing, and live job tracking from a single modern
            dashboard — book once or whenever you need a clean.
          </p>

          <ul className="mt-8 space-y-3">
            {[
              "Find trusted cleaners without the phone tag",
              "Book as needed — one-off or recurring",
              "See pricing upfront before you confirm",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-slate-600 sm:text-base">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
                {item}
              </li>
            ))}
          </ul>

          <Link href={jobFlowHref} className="btn-primary mt-10 inline-flex gap-2 px-8 py-4 text-base">
            Get your free quote
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="about-story-visual relative min-h-[22rem] overflow-hidden rounded-[2rem] shadow-xl shadow-emerald-900/10 sm:min-h-[26rem] lg:min-h-[32rem]">
          <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/80 via-teal-900/25 to-transparent" />
          <div className="relative flex h-full min-h-[inherit] flex-col justify-between p-7 sm:p-8">
            <div>
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                <CheckCircle2 className="h-5 w-5 text-white" />
              </div>
              <p className="mt-5 max-w-xs text-lg font-medium leading-snug text-white">
                Professional cleaning on your schedule — vetted, insured, and tracked from booking
                to finish.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {TAGS.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-white/15 px-4 py-2 text-sm font-medium text-white backdrop-blur-md"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
