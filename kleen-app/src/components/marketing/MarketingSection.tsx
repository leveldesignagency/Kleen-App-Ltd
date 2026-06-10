import type { ReactNode } from "react";
import RevealOnScroll from "@/components/marketing/RevealOnScroll";
import OrganicCanvasBackground from "@/components/marketing/OrganicCanvasBackground";

type MarketingSectionProps = {
  children: ReactNode;
  className?: string;
  maskClassName?: string;
  innerClassName?: string;
  /** Pull the mask up over a dark hero */
  overlap?: boolean;
  /** white = default card mask, brand = gradient CTA mask */
  variant?: "white" | "brand";
  /** Skip outer vertical rhythm (e.g. last section before footer) */
  noPad?: boolean;
  /** Fade/slide mask in on scroll */
  reveal?: boolean;
};

const maskVariants = {
  white:
    "bg-white shadow-[0_4px_24px_rgba(0,0,0,0.12)] ring-1 ring-white",
  brand:
    "bg-gradient-to-br from-brand-600 to-brand-700 shadow-[0_8px_32px_rgba(8,145,178,0.25)] ring-1 ring-brand-500/30",
};

export function MarketingCanvas({
  children,
  className = "",
  organic = true,
}: {
  children: ReactNode;
  className?: string;
  organic?: boolean;
}) {
  return (
    <div className={`marketing-canvas relative ${className}`.trim()}>
      {organic ? <OrganicCanvasBackground /> : null}
      <div className="relative">{children}</div>
    </div>
  );
}

export function MarketingSection({
  children,
  className = "",
  maskClassName = "",
  innerClassName = "",
  overlap = false,
  variant = "white",
  noPad = false,
  reveal = true,
}: MarketingSectionProps) {
  const mask = (
    <div
      className={[
        "mx-auto max-w-screen-2xl overflow-hidden rounded-[1.75rem] sm:rounded-[2.25rem] lg:rounded-[2.5rem]",
        maskVariants[variant],
        maskClassName,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className={[
          "px-6 py-10 sm:px-10 sm:py-12 lg:px-14 lg:py-16",
          innerClassName,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {children}
      </div>
    </div>
  );

  return (
    <section
      className={[
        "relative px-4 sm:px-6 lg:px-8",
        overlap ? "-mt-16 z-10 sm:-mt-20" : "",
        noPad ? "pb-0" : "py-3 sm:py-4",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {reveal ? <RevealOnScroll>{mask}</RevealOnScroll> : mask}
    </section>
  );
}

export function MarketingSectionHeader({
  title,
  description,
  className = "",
  light = false,
}: {
  title: string;
  description?: string;
  className?: string;
  light?: boolean;
}) {
  return (
    <div className={`text-center ${className}`.trim()}>
      <h2
        className={`text-3xl font-bold tracking-tight sm:text-4xl ${
          light ? "text-white" : "text-slate-900"
        }`}
      >
        {title}
      </h2>
      {description ? (
        <p className={`mt-3 ${light ? "text-brand-100" : "text-slate-500"}`}>
          {description}
        </p>
      ) : null}
    </div>
  );
}
