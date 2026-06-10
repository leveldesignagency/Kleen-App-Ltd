import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

const QUOTE_LINES = [
  { label: "Driveway clean", detail: "Exterior · SW1A", amount: "£80" },
  { label: "End-of-tenancy", detail: "Interior · 2 bed", amount: "£148" },
  { label: "Deep clean add-on", detail: "Kitchen & bathroom", amount: "£35" },
];

export default function HomePricingSection() {
  return (
    <section className="bg-white py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-screen-2xl">
        <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
          <div className="fintech-panel-card relative flex min-h-[20rem] flex-col overflow-hidden rounded-[2rem] p-8 sm:min-h-[22rem] sm:p-10">
            <div className="fintech-panel-shapes" aria-hidden="true" />
            <p className="relative z-[1] text-sm font-medium text-slate-400">01.</p>
            <h3 className="relative z-[1] mt-6 max-w-sm text-3xl font-bold leading-tight tracking-tight text-slate-900 sm:text-4xl">
              Transparent pricing upfront
            </h3>
            <p className="relative z-[1] mt-4 max-w-md text-sm leading-relaxed text-slate-500 sm:text-base">
              See your quote before you book — no callbacks, no surprises at the door. Every job
              is priced in real time based on what you actually need.
            </p>
            <Link
              href="/faq#pricing"
              className="relative z-[1] mt-auto inline-flex items-center gap-2 pt-10 text-xs font-semibold uppercase tracking-[0.14em] text-slate-900 transition-colors hover:text-brand-600"
            >
              How pricing works
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="fintech-panel-card relative min-h-[20rem] overflow-hidden rounded-[2rem] p-6 sm:min-h-[22rem] sm:p-8">
            <div className="rounded-[1.25rem] bg-white p-5 shadow-sm sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Your quote
              </p>
              <div className="mt-4 space-y-4">
                {QUOTE_LINES.map((line) => (
                  <div key={line.label} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-600">
                        {line.label.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{line.label}</p>
                        <p className="text-xs text-slate-400">{line.detail}</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-slate-700">{line.amount}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="absolute bottom-6 right-6 rounded-full bg-slate-900 px-5 py-3 text-white shadow-lg sm:bottom-8 sm:right-8">
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                Estimated total
              </p>
              <p className="text-lg font-bold tracking-tight">£124 – £148</p>
            </div>
          </div>
        </div>

        <div className="mt-14 grid gap-8 lg:mt-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:gap-12">
          <h2 className="text-3xl font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-4xl lg:text-[2.75rem]">
            Pricing that&apos;s simple, clear &amp; in your control
          </h2>
          <div className="lg:pb-1">
            <p className="max-w-md text-sm leading-relaxed text-slate-500 sm:text-base">
              From a quick refresh to a full end-of-tenancy clean, you always know what you&apos;re
              paying before you confirm. No hidden fees — just honest estimates and vetted
              professionals.
            </p>
            <Link
              href="/services"
              className="mt-6 inline-flex items-center rounded-full bg-slate-900 px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
            >
              See our services
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
