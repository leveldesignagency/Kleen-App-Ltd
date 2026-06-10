"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import MarketingFeatureCard from "@/components/marketing/MarketingFeatureCard";

export type FeatureCardItem = {
  icon: LucideIcon;
  title: string;
  description: string;
  href?: string;
  linkLabel?: string;
  footerLabel?: string;
};

export type FeatureStatItem = {
  value: string;
  label: string;
};

type SectionPhase = "idle" | "intro" | "interactive";

type HomeFeatureCardsSectionProps = {
  badgeIcon: LucideIcon;
  badgeLabel: string;
  title: string;
  titleHighlight: string;
  description: string;
  cards: FeatureCardItem[];
  stats: FeatureStatItem[];
  cta?: { href: string; label: string };
};

const CENTER_CARD_INDEX = 1;

export default function HomeFeatureCardsSection({
  badgeIcon: BadgeIcon,
  badgeLabel,
  title,
  titleHighlight,
  description,
  cards,
  stats,
  cta,
}: HomeFeatureCardsSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const [phase, setPhase] = useState<SectionPhase>("idle");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPhase((current) => (current === "idle" ? "intro" : current));
        }
      },
      { threshold: 0.3, rootMargin: "-40px 0px" },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (phase !== "intro") return;

    const enterInteractive = () => {
      setPhase((current) => (current === "intro" ? "interactive" : current));
    };

    const timer = window.setTimeout(() => {
      window.addEventListener("scroll", enterInteractive, { passive: true, once: true });
      window.addEventListener("wheel", enterInteractive, { passive: true, once: true });
      window.addEventListener("touchmove", enterInteractive, { passive: true, once: true });
    }, 500);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", enterInteractive);
      window.removeEventListener("wheel", enterInteractive);
      window.removeEventListener("touchmove", enterInteractive);
    };
  }, [phase]);

  const enterInteractive = () => {
    setPhase((current) => (current === "intro" ? "interactive" : current));
    setHoveredIndex(null);
  };

  return (
    <section ref={sectionRef} className="relative bg-white pt-12 sm:pt-16 lg:pt-20">
      <div className="mx-auto max-w-screen-2xl py-16 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-4 py-1.5 text-sm font-semibold text-brand-700">
            <BadgeIcon className="h-4 w-4" />
            {badgeLabel}
          </div>
          <h2 className="mt-5 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
            {title}{" "}
            <span className="bg-gradient-to-r from-brand-700 via-brand-600 to-brand-400 bg-clip-text text-transparent">
              {titleHighlight}
            </span>
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-500">{description}</p>
        </div>

        <div
          className="mt-14 grid grid-cols-1 items-end gap-5 lg:grid-cols-3 lg:gap-6"
          onPointerEnter={enterInteractive}
        >
          {cards.map((card, index) => {
            const Icon = card.icon;
            const isIntroFeatured = phase === "intro" && index === CENTER_CARD_INDEX;
            const isHoverFeatured = phase === "interactive" && hoveredIndex === index;
            const isFeatured = isIntroFeatured || isHoverFeatured;
            const isLifted = isFeatured;

            return (
              <div
                key={card.title}
                className="h-full"
                onMouseEnter={() => {
                  if (phase === "interactive") setHoveredIndex(index);
                }}
                onMouseLeave={() => setHoveredIndex(null)}
                onFocus={() => {
                  if (phase === "interactive") setHoveredIndex(index);
                }}
                onBlur={() => setHoveredIndex(null)}
              >
                <MarketingFeatureCard
                  icon={Icon}
                  title={card.title}
                  description={card.description}
                  href={card.href}
                  linkLabel={card.linkLabel}
                  footerLabel={card.footerLabel}
                  featured={isFeatured}
                  className={[
                    "h-full transition-all duration-500 ease-out",
                    isLifted
                      ? [
                          "relative z-10 shadow-xl shadow-brand-600/20",
                          isIntroFeatured
                            ? "-translate-y-6 scale-[1.04]"
                            : "-translate-y-3 scale-[1.02]",
                        ].join(" ")
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                />
              </div>
            );
          })}
        </div>

        <div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map((stat, i) => {
            const featured = i === 1;
            return (
              <div
                key={stat.label}
                className={[
                  "rounded-2xl p-5 text-center sm:p-6",
                  featured
                    ? "bg-brand-600 text-white shadow-lg shadow-brand-600/15"
                    : "bg-slate-50",
                ].join(" ")}
              >
                <p
                  className={`text-2xl font-bold sm:text-3xl ${
                    featured ? "text-white" : "text-brand-600"
                  }`}
                >
                  {stat.value}
                </p>
                <p
                  className={`mt-1 text-xs font-medium sm:text-sm ${
                    featured ? "text-brand-100" : "text-slate-500"
                  }`}
                >
                  {stat.label}
                </p>
              </div>
            );
          })}
        </div>

        {cta ? (
          <div className="mt-12 text-center">
            <Link href={cta.href} className="btn-primary gap-2 px-8 py-4 text-base">
              {cta.label}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}
