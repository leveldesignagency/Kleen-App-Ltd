import Link from "next/link";
import { ArrowRight, Briefcase, ShieldCheck, UserPlus } from "lucide-react";
import { customerAppHref } from "@/lib/customer-app-url";
import { contractorPortalHref } from "@/lib/contractor-portal-url";

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
    body: "Sign up with your business email. You will add company details, areas, and services in the contractor portal after sign-in.",
  },
  {
    icon: ShieldCheck,
    title: "Kleen confirms your business",
    body: "Our team reviews your profile in the admin app and marks your account as verified when you are approved to take jobs.",
  },
  {
    icon: Briefcase,
    title: "Jobs, quotes & payouts",
    body: "After verification you can receive quote invitations, submit pricing, and connect Stripe for escrow payouts.",
  },
];

export default function ContractorsMarketingPage() {
  return (
    <div className="bg-white">
      <section className="border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">For professionals</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Contractor &amp; cleaner portal
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            This page is for <strong>cleaning businesses and trades</strong> who want to work with Kleen — not for
            customers booking a clean. If you need a quote for your home or business, use{" "}
            <Link href={jobFlowHref} className="font-medium text-brand-600 underline-offset-2 hover:underline">
              Get a quote
            </Link>{" "}
            from the main site.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Link href={contractorJoinHref} className="btn-primary inline-flex gap-2 px-8 py-3.5 text-base">
              Apply as a contractor
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={contractorSignInHref}
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-8 py-3.5 text-base font-medium text-slate-800 shadow-sm hover:bg-slate-50"
            >
              Contractor sign in
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-screen-lg px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="text-center text-2xl font-bold text-slate-900">How it works</h2>
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100">
                <Icon className="h-5 w-5 text-brand-700" />
              </div>
              <h3 className="mt-4 font-semibold text-slate-900">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-12 max-w-xl text-center text-sm text-slate-500">
          Looking to book a service? Go to{" "}
          <Link href="/" className="font-medium text-brand-600 hover:underline">
            the homepage
          </Link>{" "}
          or{" "}
          <Link href={customerSignInHref} className="font-medium text-brand-600 hover:underline">
            customer sign in
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
