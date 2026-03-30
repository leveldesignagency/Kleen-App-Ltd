"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  ArrowRight,
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
} from "lucide-react";
import { SERVICE_CATEGORIES } from "@/lib/services";
import { customerAppHref } from "@/lib/customer-app-url";

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
      <section className="relative -mt-[5.25rem] overflow-hidden bg-gradient-to-br from-slate-900 via-brand-950 to-slate-900">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(6,182,212,0.15),_transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(16,185,129,0.1),_transparent_60%)]" />
        <div className="relative mx-auto max-w-screen-2xl px-6 pb-20 pt-32 sm:px-10 lg:px-16 lg:pb-28 lg:pt-40">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-400/20 bg-brand-500/10 px-4 py-1.5 text-sm text-brand-300">
              <Sparkles className="h-3.5 w-3.5" />
              Professional &amp; reliable
            </div>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Our Services
            </h1>
            <p className="mt-4 text-lg text-slate-300">
              From domestic deep cleans to commercial spaces, we have you covered
              with professional, reliable cleaning solutions.
            </p>

            {/* Search bar */}
            <div className="relative mx-auto mt-8 max-w-xl">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search services... e.g. driveway, oven, carpet"
                className="w-full rounded-2xl border border-white/10 bg-white/10 py-4 pl-12 pr-12 text-white placeholder-slate-400 backdrop-blur-sm transition-all focus:border-brand-400/40 focus:bg-white/15 focus:outline-none focus:ring-2 focus:ring-brand-400/20"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition-colors hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-screen-2xl px-6 py-16 sm:px-10 lg:px-16 lg:py-24">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Search className="mx-auto h-12 w-12 text-slate-300" />
            <h3 className="mt-4 text-lg font-semibold text-slate-900">
              No services found
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              Try a different search term or{" "}
              <button
                onClick={() => setQuery("")}
                className="font-medium text-brand-600 hover:text-brand-700"
              >
                clear the search
              </button>
            </p>
          </div>
        ) : (
          <div className="space-y-20">
            {filtered.map((category) => {
              const Icon = ICON_MAP[category.icon] || Sparkles;
              const services = category.services.filter((s) => s.enabled);
              if (services.length === 0) return null;

              return (
                <div key={category.id} id={category.id}>
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 shadow-lg shadow-brand-600/25">
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900">
                        {category.name}
                      </h2>
                      <p className="text-sm text-slate-500">
                        {category.description}
                      </p>
                    </div>
                  </div>
                  <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {services.map((service) => (
                      <div
                        key={service.id}
                        className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand-200 hover:shadow-lg hover:shadow-brand-100/50"
                      >
                        <h3 className="font-semibold text-slate-900">
                          {service.name}
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-slate-500">
                          {service.description}
                        </p>
                        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                          <span className="text-xl font-bold text-brand-600">
                            From £{service.basePrice}
                          </span>
                          <Link
                            href={jobFlowHref}
                            className="flex items-center gap-1.5 text-sm font-semibold text-brand-600 transition-colors group-hover:text-brand-700"
                          >
                            Book Now
                            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
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
      </section>
    </>
  );
}
