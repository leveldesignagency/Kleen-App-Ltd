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
}

const NAV_LINKS = [
  { href: "/services", label: "Services" },
  { href: "/contractors", label: "Contractors" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/faq", label: "FAQ" },
];

const SCROLL_THRESHOLD = 50;

export default function Navbar({ user }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const isMarketingPage =
    pathname === "/" ||
    pathname === "/services" ||
    pathname === "/contractors" ||
    pathname === "/about" ||
    pathname === "/contact" ||
    pathname === "/faq";

  // Transparent nav uses white text + inverted logo — only works over dark heroes.
  // /contractors opens with a light gradient (slate-50 → white), so keep the solid bar.
  const transparent =
    isMarketingPage && pathname !== "/contractors" && !scrolled && !mobileOpen;

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

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="h-1 bg-gradient-to-r from-brand-500 via-brand-400 to-accent-400" />
      <div
        className={`transition-all duration-300 ${
          transparent
            ? "border-b border-transparent bg-transparent"
            : "border-b border-slate-200/60 bg-white/80 shadow-sm backdrop-blur-xl"
        }`}
      >
        <nav className="mx-auto flex h-20 max-w-screen-2xl items-center justify-between px-6 sm:px-10 lg:px-16">
          <Link href="/" className="flex items-center">
            <Image
              src="/images/kleen-logo.svg"
              alt="KLEEN"
              width={160}
              height={66}
              className={`h-14 w-auto transition-all duration-300 ${
                transparent ? "brightness-0 invert" : ""
              }`}
              priority
            />
          </Link>

          <div className="hidden items-center gap-6 md:flex">
            <div className="flex items-center gap-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`nav-link relative rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-300 ${
                    isActive(link.href)
                      ? transparent
                        ? "text-white nav-link-active"
                        : "text-brand-700 nav-link-active"
                      : transparent
                      ? "text-white/80 hover:text-white"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-3">
              {user ? (
                <SparkleButton href={dashboardHref}>Dashboard</SparkleButton>
              ) : (
                <>
                  <Link
                    href={jobFlowHref}
                    className={`gap-2 px-5 py-2.5 text-sm transition-all duration-300 ${
                      transparent
                        ? "btn-secondary border-white/20 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20"
                        : "btn-primary"
                    }`}
                  >
                    Get Started
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                  <Link
                    href={signInHref}
                    className={`text-sm font-medium transition-all duration-300 ${
                      transparent
                        ? "text-white/90 hover:text-white"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Log in
                  </Link>
                </>
              )}
            </div>
          </div>

          <button
            className={`rounded-lg p-2.5 transition-colors md:hidden ${
              transparent
                ? "text-white/80 hover:bg-white/10 hover:text-white"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            }`}
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </nav>
      </div>

      {mobileOpen && (
        <div className="border-b border-slate-200/60 bg-white px-5 pb-5 pt-3 shadow-lg md:hidden">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`block rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                isActive(link.href)
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
            {user ? (
              <SparkleButton
                href={dashboardHref}
                onClick={() => setMobileOpen(false)}
              >
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
                  className="block rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => setMobileOpen(false)}
                >
                  Log in
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
