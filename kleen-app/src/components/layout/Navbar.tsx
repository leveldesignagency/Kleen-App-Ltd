"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Menu, X, ArrowRight } from "lucide-react";
import SparkleButton from "@/components/ui/SparkleButton";
import { customerAppHref } from "@/lib/customer-app-url";

interface NavbarProps {
  user?: { email: string } | null;
  framed?: boolean;
}

const NAV_LINKS = [
  { href: "/services", label: "Services" },
  { href: "/contractors", label: "Contractors" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/faq", label: "FAQ" },
];

const SCROLL_THRESHOLD = 48;

export default function Navbar({ user, framed = false }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const isHome = pathname === "/";
  const atHeroTop = isHome && !scrolled && !mobileOpen;
  const shellActive = !atHeroTop;
  const useLightNav = shellActive || atHeroTop;
  const useFixedNav = isHome;
  const headerPadding = "px-4 pt-4 sm:px-5 sm:pt-5 lg:px-6 lg:pt-6";

  const jobFlowHref = customerAppHref("/job-flow");
  const signInHref = customerAppHref("/sign-in");
  const dashboardHref = customerAppHref("/dashboard");

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > SCROLL_THRESHOLD);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const linkClass = (href: string) => {
    const active = isActive(href);
    if (useLightNav) {
      return active
        ? "rounded-full bg-white/20 px-3.5 py-2 text-sm font-medium text-white lg:px-4"
        : "rounded-full px-3.5 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/12 hover:text-white lg:px-4";
    }
    return active
      ? "rounded-full bg-brand-50 px-3.5 py-2 text-sm font-medium text-brand-700 lg:px-4"
      : "rounded-full px-3.5 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 lg:px-4";
  };

  return (
    <header
      className={`z-50 ${
        useFixedNav
          ? `fixed inset-x-0 top-0 ${headerPadding}`
          : `sticky top-0 ${headerPadding}`
      }`}
    >
      {!framed ? (
        <div className="h-1 bg-gradient-to-r from-brand-500 via-brand-400 to-accent-400" />
      ) : null}
      <nav className="mx-auto max-w-screen-2xl">
        <div
          className="marketing-nav-shell relative flex h-[4.5rem] w-full items-center justify-between gap-4 px-2 sm:h-20 sm:px-4 lg:px-6"
          data-active={shellActive ? "true" : "false"}
        >
          <Link href="/" className="relative z-[1] flex shrink-0 items-center">
            <Image
              src="/images/kleen-logo.svg"
              alt="KLEEN"
              width={160}
              height={66}
              className={`h-11 w-auto transition-[filter] duration-300 sm:h-14 ${
                useLightNav ? "brightness-0 invert" : ""
              }`}
              priority
            />
          </Link>

          <div className="relative z-[1] hidden items-center gap-0.5 md:flex">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className={linkClass(link.href)}>
                {link.label}
              </Link>
            ))}

            <span
              className={`mx-1 h-6 w-px shrink-0 ${useLightNav ? "bg-white/25" : "bg-slate-200"}`}
              aria-hidden="true"
            />

            {user ? (
              <SparkleButton href={dashboardHref} className="!rounded-full !py-2 !text-sm">
                Dashboard
              </SparkleButton>
            ) : (
              <>
                <Link
                  href={signInHref}
                  className={`rounded-full px-3.5 py-2 text-sm font-medium transition-colors lg:px-4 ${
                    useLightNav
                      ? "text-white/90 hover:bg-white/12 hover:text-white"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  Log in
                </Link>
                <Link
                  href={jobFlowHref}
                  className={
                    useLightNav
                      ? "btn-hero-nav !gap-1.5 !px-4 !py-2 !text-sm"
                      : "btn-primary gap-1.5 rounded-full px-4 py-2 text-sm"
                  }
                >
                  Get Started
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </>
            )}
          </div>

          <button
            className={`relative z-[1] ml-auto rounded-full p-2.5 transition-colors md:hidden ${
              useLightNav
                ? "text-white/85 hover:bg-white/12 hover:text-white"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            }`}
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileOpen && (
          <div
            className="marketing-nav-mobile-panel mx-auto mt-2 px-5 pb-5 pt-3 md:hidden"
            data-active={shellActive ? "true" : "false"}
          >
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`block rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                  isActive(link.href)
                    ? shellActive
                      ? "bg-white/20 text-white"
                      : "bg-brand-50 text-brand-700"
                    : shellActive
                      ? "text-white/85 hover:bg-white/12"
                      : "text-slate-600 hover:bg-slate-50"
                }`}
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div
              className={`mt-4 space-y-2 border-t pt-4 ${shellActive ? "border-white/20" : "border-slate-100"}`}
            >
              {user ? (
                <SparkleButton href={dashboardHref} onClick={() => setMobileOpen(false)}>
                  Dashboard
                </SparkleButton>
              ) : (
                <>
                  <Link
                    href={jobFlowHref}
                    className="btn-primary flex w-full items-center justify-center gap-2 py-3 text-sm"
                    onClick={() => setMobileOpen(false)}
                  >
                    Get Started
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                  <Link
                    href={signInHref}
                    className={`block rounded-xl px-4 py-3 text-center text-sm font-medium ${
                      shellActive
                        ? "border border-white/20 bg-white/10 text-white hover:bg-white/15"
                        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                    onClick={() => setMobileOpen(false)}
                  >
                    Log in
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
