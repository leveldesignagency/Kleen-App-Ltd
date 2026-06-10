import Link from "next/link";
import { ArrowRight, Play, Sparkles } from "lucide-react";
import KineticHighlight from "@/components/marketing/KineticHighlight";
import HeroProductPreview from "@/components/marketing/HeroProductPreview";

type MarketingHeroProps = {
  jobFlowHref: string;
};

export default function MarketingHero({ jobFlowHref }: MarketingHeroProps) {
  return (
    <section className="marketing-hero-gradient relative mt-4 min-h-[34rem] overflow-hidden rounded-2xl sm:mt-5 sm:min-h-[38rem] lg:mt-6 lg:min-h-[44rem]">
      <div className="relative mx-auto flex min-h-[inherit] max-w-screen-2xl items-center pb-16 pt-36 sm:pb-20 sm:pt-40 lg:pb-24 lg:pt-48">
        <div className="grid items-center gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:gap-2 xl:gap-4">
          <div className="lg:py-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-medium text-white backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5" />
              Professional cleaning, simplified
            </div>

            <h1 className="mt-6 text-[1.75rem] font-bold leading-[1.12] tracking-tight text-white sm:text-5xl lg:text-[3.25rem] lg:leading-[1.08]">
              <span className="block whitespace-nowrap">Book trusted cleaners</span>
              <span className="block whitespace-nowrap">
                <KineticHighlight tone="light">in minutes</KineticHighlight>
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-brand-50/90">
              Instant quotes, vetted professionals, and live job tracking — all from one
              modern dashboard. No phone tag. No guesswork.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href={jobFlowHref} className="btn-hero-primary">
                Get your free quote
                <span className="relative z-[1] flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-white">
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
              <Link href="/services" className="btn-hero-secondary">
                <Play className="h-4 w-4 fill-white/80 text-white/80" />
                Browse services
              </Link>
            </div>

            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-brand-100/90">
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
                Instant pricing
              </span>
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
                Live job tracking
              </span>
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
                Fully insured
              </span>
            </div>
          </div>

          <div className="relative z-10 flex justify-center lg:justify-end lg:-mr-8 lg:translate-x-14 xl:-mr-12 xl:translate-x-24 2xl:-mr-16 2xl:translate-x-[9rem]">
            <div className="w-full max-w-md lg:max-w-none lg:translate-y-6 lg:pb-4">
              <HeroProductPreview />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
