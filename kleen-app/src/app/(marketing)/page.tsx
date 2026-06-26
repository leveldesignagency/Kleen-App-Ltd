import Link from "next/link";
import GatedAppLink from "@/components/auth/GatedAppLink";
import { customerAppHref } from "@/lib/customer-app-url";
import { contractorPortalHref } from "@/lib/contractor-portal-url";
import MarketingHero from "@/components/marketing/MarketingHero";
import HomeTrustBar from "@/components/marketing/HomeTrustBar";
import HomeHowItWorksSection from "@/components/marketing/HomeHowItWorksSection";
import HomeServicesSection from "@/components/marketing/HomeServicesSection";
import HomePricingSection from "@/components/marketing/HomePricingSection";
import { MarketingSectionHeader } from "@/components/marketing/MarketingSection";
import {
  ArrowRight,
  Shield,
  Clock,
  Star,
  CheckCircle2,
} from "lucide-react";

const TRUST_SIGNALS = [
  { icon: Shield, title: "Fully Insured", desc: "Complete peace of mind with comprehensive insurance coverage" },
  { icon: Clock, title: "Flexible Scheduling", desc: "Book at times that suit you, 7 days a week" },
  { icon: Star, title: "5-Star Rated", desc: "Consistently rated excellent by our customers" },
  { icon: CheckCircle2, title: "Vetted Cleaners", desc: "Background-checked and professionally trained" },
];

const jobFlowHref = customerAppHref("/job-flow");
const contractorApplyHref = contractorPortalHref("/contractor/join");

export default function HomePage() {
  return (
    <>
      <MarketingHero jobFlowHref={jobFlowHref} />
      <HomeTrustBar items={TRUST_SIGNALS} />

      <HomeServicesSection />

      <HomePricingSection />

      <section className="bg-slate-50/80 py-8">
        <div className="mx-auto flex max-w-screen-2xl flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <p className="text-sm text-slate-700">
            <span className="font-semibold text-slate-900">Professional cleaner or trade business?</span>{" "}
            Apply to work with Kleen — separate from customer booking.
          </p>
          <Link
            href={contractorApplyHref}
            className="shrink-0 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:text-brand-700"
          >
            Apply as a contractor
          </Link>
        </div>
      </section>

      <HomeHowItWorksSection jobFlowHref={jobFlowHref} />

      <section className="bg-brand-50/50 py-16 text-center lg:py-20">
        <div className="mx-auto max-w-screen-2xl">
          <MarketingSectionHeader
            title="Ready to get started?"
            description="Get an instant quote in under 2 minutes. No obligation."
          />
          <div className="mt-8">
            <GatedAppLink href={jobFlowHref} className="btn-primary gap-2 rounded-full px-8 py-4 text-base">
              Get Your Free Quote
              <ArrowRight className="h-4 w-4" />
            </GatedAppLink>
          </div>
        </div>
      </section>
    </>
  );
}
