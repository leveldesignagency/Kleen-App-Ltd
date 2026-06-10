import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";

type MarketingFeatureCardProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  href?: string;
  linkLabel?: string;
  footerLabel?: string;
  className?: string;
  featured?: boolean;
};

export default function MarketingFeatureCard({
  icon: Icon,
  title,
  description,
  href,
  linkLabel = "Learn more",
  footerLabel,
  className = "",
  featured = false,
}: MarketingFeatureCardProps) {
  return (
    <div className={["marketing-feature-card flex h-full flex-col", className].filter(Boolean).join(" ")}>
      <div
        className={[
          "marketing-feature-card-panel relative flex flex-1 flex-col overflow-hidden rounded-[1.25rem] p-7 sm:p-8",
          featured ? "marketing-feature-card-panel-featured" : "",
        ].join(" ")}
      >
        <div className="marketing-feature-card-grid" aria-hidden="true" />

        <div
          className={[
            "relative z-[1] flex h-11 w-11 items-center justify-center rounded-full",
            featured ? "bg-white/20 text-white" : "bg-brand-600 text-white",
          ].join(" ")}
        >
          <Icon className="h-5 w-5" />
        </div>

        <h3
          className={[
            "relative z-[1] mt-5 text-xl font-bold tracking-tight",
            featured ? "text-white" : "text-slate-900",
          ].join(" ")}
        >
          {title}
        </h3>
        <p
          className={[
            "relative z-[1] mt-2 flex-1 text-sm leading-relaxed",
            featured ? "text-brand-50/95" : "text-slate-500",
          ].join(" ")}
        >
          {description}
        </p>
      </div>

      {href ? (
        <div className="px-1 pb-1 pt-4">
          <Link href={href} className="marketing-feature-card-action group">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white transition-transform group-hover:translate-x-0.5">
              <ChevronRight className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold text-slate-800">{linkLabel}</span>
          </Link>
        </div>
      ) : footerLabel ? (
        <div className="px-1 pb-1 pt-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {footerLabel}
          </span>
        </div>
      ) : null}
    </div>
  );
}
