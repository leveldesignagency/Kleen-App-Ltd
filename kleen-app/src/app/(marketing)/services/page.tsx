"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Home,
  Sparkles,
  CloudRain,
  ChefHat,
  Key,
  Car,
  TreePine,
  Building2,
  Trash2,
  Search,
  X,
  ChevronRight,
} from "lucide-react";
import { SERVICE_CATEGORIES } from "@/lib/services";
import { customerAppHref } from "@/lib/customer-app-url";
import MarketingPageHero, {
  MarketingPageSection,
  marketingCardHover,
  marketingCardPanel,
  marketingCardAction,
  marketingIconBox,
} from "@/components/marketing/MarketingPageHero";

const jobFlowHref = customerAppHref("/job-flow");

const ICON_MAP: Record<string, React.ElementType> = {
  Home,
  Sparkles,
  CloudRain,
  ChefHat,
  Key,
  Car,
  TreePine,
  Building2,
  Trash2,
};

export default function ServicesPage() {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return SERVICE_CATEGORIES;

    return SERVICE_CATEGORIES.map((category) => {
      const matchingServices = category.services.filter(
        (s) =>
          s.enabled &&
          (s.name.toLowerCase().includes(q) ||
            s.description.toLowerCase().includes(q) ||
            category.name.toLowerCase().includes(q))
      );

      if (matchingServices.length > 0) {
        return { ...category, services: matchingServices };
      }
      return null;
    }).filter(Boolean) as typeof SERVICE_CATEGORIES;
  }, [query]);

  return (
    <>
      <MarketingPageHero
        badge="Professional & reliable"
        title="Our services"
        description="From domestic deep cleans to commercial spaces — professional, reliable cleaning with transparent pricing."
      >
        <div className="relative mx-auto mt-8 max-w-xl">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search services… e.g. driveway, oven, carpet"
            className="w-full rounded-2xl bg-slate-50 py-4 pl-12 pr-12 text-base text-slate-900 shadow-sm placeholder:text-slate-400 transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </MarketingPageHero>

      <MarketingPageSection>
          {filtered.length === 0 ? (
            <div className="rounded-[1.5rem] bg-slate-50 py-16 text-center">
              <Search className="mx-auto h-12 w-12 text-slate-300" />
              <h3 className="mt-4 text-lg font-semibold text-slate-900">No services found</h3>
              <p className="mt-2 text-sm text-slate-500">
                Try a different search term or{" "}
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="font-medium text-brand-600 hover:text-brand-700"
                >
                  clear the search
                </button>
              </p>
            </div>
          ) : (
            <div className="space-y-16 lg:space-y-20">
              {filtered.map((category) => {
                const Icon = ICON_MAP[category.icon] || Sparkles;
                const services = category.services.filter((s) => s.enabled);
                if (services.length === 0) return null;

                return (
                  <div key={category.id} id={category.id}>
                    <div className="flex items-center gap-4">
                      <div className={marketingIconBox}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.75rem]">
                          {category.name}
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">{category.description}</p>
                      </div>
                    </div>

                    <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
                      {services.map((service) => (
                        <div key={service.id} className={`group flex flex-col ${marketingCardHover}`}>
                          <div className={marketingCardPanel}>
                            <h3 className="text-lg font-bold text-slate-900">{service.name}</h3>
                            <p className="mt-2 text-sm leading-relaxed text-slate-500">
                              {service.description}
                            </p>
                          </div>
                          <div className="flex items-center justify-between gap-3 px-1 pb-1 pt-4">
                            <span className="text-xl font-bold text-brand-600">
                              From £{service.basePrice}
                            </span>
                            <Link href={jobFlowHref} className={marketingCardAction}>
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white transition-transform group-hover:translate-x-0.5">
                                <ChevronRight className="h-4 w-4" />
                              </span>
                              <span className="text-sm font-semibold text-slate-800">Book now</span>
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
      </MarketingPageSection>
    </>
  );
}
