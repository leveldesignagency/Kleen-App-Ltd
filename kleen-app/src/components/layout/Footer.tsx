import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import SparkleButton from "@/components/ui/SparkleButton";
import { customerAppHref } from "@/lib/customer-app-url";

const jobFlowHref = customerAppHref("/job-flow");
const signInHref = customerAppHref("/sign-in");
const dashboardHref = customerAppHref("/dashboard");

const FOOTER_PRIMARY = [
  { href: "/services", label: "All Services" },
  { href: jobFlowHref, label: "Get a Quote" },
  { href: "/faq", label: "FAQ" },
] as const;

const FOOTER_SECONDARY = [
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/contractors", label: "Contractors" },
] as const;

const FOOTER_LEGAL = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
] as const;

interface FooterProps {
  user?: { email: string } | null;
}

export default function Footer({ user = null }: FooterProps) {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-screen-2xl px-6 py-10 sm:px-10 lg:px-16">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
          <Link href="/" className="w-fit shrink-0">
            <Image
              src="/images/kleen-logo.svg"
              alt="KLEEN"
              width={140}
              height={58}
              className="h-10 w-auto sm:h-11"
            />
          </Link>

          <nav
            aria-label="Footer"
            className="flex min-w-0 flex-1 flex-col flex-wrap gap-4 sm:flex-row sm:items-center sm:gap-x-0 sm:gap-y-2 md:justify-center"
          >
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 sm:gap-x-6">
              {FOOTER_PRIMARY.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-slate-800 transition-colors hover:text-slate-950"
                >
                  {link.label}
                </Link>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-slate-200 sm:gap-x-6 sm:border-l sm:pl-6">
              {FOOTER_SECONDARY.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-slate-800 transition-colors hover:text-slate-950"
                >
                  {link.label}
                </Link>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-slate-200 sm:gap-x-6 sm:border-l sm:pl-6">
              {FOOTER_LEGAL.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-slate-600 transition-colors hover:text-slate-900"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </nav>

          <div className="mt-2 flex flex-wrap items-center gap-3 border-slate-100 pt-4 max-lg:border-t sm:gap-4 lg:mt-0 lg:shrink-0 lg:border-t-0 lg:border-l lg:border-slate-200 lg:pl-6 lg:pt-0">
            {user ? (
              <SparkleButton href={dashboardHref} className="text-sm">
                Dashboard
              </SparkleButton>
            ) : (
              <>
                <Link
                  href={signInHref}
                  className="text-sm font-medium text-slate-800 underline decoration-slate-300 underline-offset-4 transition-colors hover:text-slate-950 hover:decoration-slate-500"
                >
                  Log in
                </Link>
                <Link
                  href={jobFlowHref}
                  className="btn-primary inline-flex gap-2 rounded-full px-5 py-2.5 text-sm"
                >
                  Get Started
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </>
            )}
          </div>
        </div>

        <p className="mt-8 max-w-xl text-sm leading-relaxed text-slate-500">
          Professional cleaning services for homes and businesses. Quality you
          can trust.
        </p>

        <div className="mt-8 border-t border-slate-100 pt-6 text-center text-xs text-slate-400 sm:text-left">
          &copy; {new Date().getFullYear()} KLEEN. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
