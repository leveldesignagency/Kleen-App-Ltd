import Link from "next/link";
import { ArrowRight, ArrowUpRight, Briefcase, ShieldCheck, UserPlus } from "lucide-react";
import { customerAppHref } from "@/lib/customer-app-url";
import { contractorPortalHref } from "@/lib/contractor-portal-url";
import MarketingFeatureCard from "@/components/marketing/MarketingFeatureCard";
import MarketingPageHero, {
  MarketingPageSection,
  marketingCard,
  marketingCardPanel,
} from "@/components/marketing/MarketingPageHero";

const jobFlowHref = customerAppHref("/job-flow");
const customerSignInHref = customerAppHref("/sign-in");
const contractorJoinHref = contractorPortalHref("/contractor/join");
const contractorSignInHref = contractorPortalHref("/contractor/sign-in");

export const metadata = {
  title: "Contractors & cleaners | KLEEN",
  description:
    "Apply to work with Kleen as a verified contractor. This is not the customer booking flow — book cleaning jobs on the home page instead.",
};

const STEPS = [
  {
    icon: UserPlus,
    title: "Create your contractor account",
    body: "Sign in with Google, then complete the application checklist in the contractor portal — profile, services, and bank details.",
  },
  {
    icon: ShieldCheck,
    title: "Kleen confirms your business",
    body: "Submit your completed application for review. Kleen approves you in the admin app — or adds contractors manually — before jobs unlock.",
  },
  {
    icon: Briefcase,
    title: "Jobs, quotes & payouts",
    body: "After verification you can browse local jobs, submit quotes, and get paid via the bank details on your application.",
  },
];

export default function ContractorsMarketingPage() {
  return (
    <>
      <MarketingPageHero
        badge="For professionals"
        title="Contractor & cleaner portal"
        description="This page is for cleaning businesses and trades who want to work with Kleen — not for customers booking a clean."
      >
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <Link href={contractorJoinHref} className="btn-primary inline-flex gap-2 px-8 py-3.5 text-base">
            Apply as a contractor
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href={contractorSignInHref} className="btn-secondary px-8 py-3.5 text-base">
            Contractor sign in
          </Link>
        </div>
        <p className="mx-auto mt-6 max-w-xl text-sm text-slate-500">
          Need a quote for your home or business?{" "}
          <Link href={jobFlowHref} className="font-semibold text-brand-600 hover:text-brand-700">
            Get a quote
          </Link>{" "}
          from the main site instead.
        </p>
      </MarketingPageHero>

      <MarketingPageSection>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">How it works</h2>
          <p className="mt-3 text-slate-500">Three steps to start taking jobs on the platform.</p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <MarketingFeatureCard
                key={step.title}
                icon={Icon}
                title={step.title}
                description={step.body}
                footerLabel={`Step ${String(index + 1).padStart(2, "0")}`}
              />
            );
          })}
        </div>

        <div className={`mt-12 text-center ${marketingCard}`}>
          <div className={marketingCardPanel}>
          <p className="text-sm text-slate-600">
            Looking to book a service? Go to{" "}
            <Link href="/" className="font-semibold text-brand-600 hover:text-brand-700">
              the homepage
            </Link>{" "}
            or{" "}
            <Link href={customerSignInHref} className="font-semibold text-brand-600 hover:text-brand-700">
              customer sign in
            </Link>
            .
          </p>
          <Link
            href={contractorJoinHref}
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-700"
          >
            Start your application
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm">
              <ArrowUpRight className="h-4 w-4" />
            </span>
          </Link>
          </div>
        </div>
      </MarketingPageSection>
    </>
  );
}
