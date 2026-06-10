"use client";

import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";

type MarketingPageHeroProps = {
  badge: string;
  title: string;
  description: string;
  children?: ReactNode;
  compact?: boolean;
};

export default function MarketingPageHero({
  badge,
  title,
  description,
  children,
  compact = false,
}: MarketingPageHeroProps) {
  return (
    <section className="bg-white">
      <div
        className={[
          "mx-auto max-w-screen-2xl",
          compact
            ? "pb-10 pt-28 sm:pb-12 lg:pb-14 lg:pt-32"
            : "pb-12 pt-28 sm:pb-14 lg:pb-16 lg:pt-36",
        ].join(" ")}
      >
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-1.5 text-sm font-semibold text-brand-700">
            <Sparkles className="h-3.5 w-3.5" />
            {badge}
          </div>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-[3.25rem] lg:leading-tight">
            {title}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-slate-500">{description}</p>
          {children}
        </div>
      </div>
    </section>
  );
}

export function MarketingPageSection({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`bg-white pb-16 pt-0 sm:pb-20 lg:pb-24 ${className}`.trim()}>
      <div className="mx-auto max-w-screen-2xl">{children}</div>
    </section>
  );
}

export function MarketingStatGrid({
  stats,
}: {
  stats: { value: string; label: string }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {stats.map((stat, i) => {
        const featured = i === 1;
        return (
          <div
            key={stat.label}
            className={[
              "rounded-2xl p-5 text-center sm:p-6",
              featured ? "bg-brand-600 text-white shadow-lg shadow-brand-600/15" : "bg-slate-50",
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
  );
}

export const marketingCard = "marketing-feature-card";

export const marketingCardPanel =
  "marketing-feature-card-panel relative overflow-hidden rounded-[1.25rem] p-7 sm:p-8";

export const marketingCardHover =
  "marketing-feature-card transition-all duration-300 hover:-translate-y-1 hover:border-slate-300";

export const marketingCardAction = "marketing-feature-card-action group";

export const marketingIconBox =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white";
