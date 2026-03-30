import Link from "next/link";
import { Metadata } from "next";
import { customerAppHref } from "@/lib/customer-app-url";

const jobFlowHref = customerAppHref("/job-flow");
import { Shield, Heart, Leaf, Award, Sparkles, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Learn about KLEEN — our mission, values, and commitment to quality cleaning.",
};

const VALUES = [
  {
    icon: Shield,
    title: "Trust & Reliability",
    desc: "Every cleaner is vetted, insured, and held to the highest professional standards.",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    icon: Heart,
    title: "Customer First",
    desc: "Your satisfaction drives everything we do. We're not happy until you are.",
    gradient: "from-rose-500 to-pink-500",
  },
  {
    icon: Leaf,
    title: "Eco-Conscious",
    desc: "We use environmentally responsible products and methods wherever possible.",
    gradient: "from-emerald-500 to-teal-500",
  },
  {
    icon: Award,
    title: "Quality Assured",
    desc: "Consistent, high-quality results backed by our satisfaction guarantee.",
    gradient: "from-amber-500 to-orange-500",
  },
];

const STATS = [
  { value: "5,000+", label: "Jobs Completed" },
  { value: "98%", label: "Satisfaction Rate" },
  { value: "200+", label: "Vetted Cleaners" },
  { value: "50+", label: "Areas Covered" },
];

export default function AboutPage() {
  return (
    <>
      <section className="relative -mt-[5.25rem] overflow-hidden bg-gradient-to-br from-slate-900 via-brand-950 to-slate-900">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(6,182,212,0.15),_transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(16,185,129,0.1),_transparent_60%)]" />
        <div className="relative mx-auto max-w-screen-2xl px-6 pb-20 pt-32 sm:px-10 lg:px-16 lg:pb-28 lg:pt-40">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-400/20 bg-brand-500/10 px-4 py-1.5 text-sm text-brand-300">
              <Sparkles className="h-3.5 w-3.5" />
              Our story
            </div>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-5xl">
              About KLEEN
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-slate-300">
              We started KLEEN with a simple belief: booking a professional clean
              should be as easy as ordering a taxi. No phone calls, no guesswork —
              just instant quotes, transparent pricing, and trusted professionals
              at your door.
            </p>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-screen-2xl grid-cols-2 gap-6 px-6 py-10 sm:px-10 md:grid-cols-4 lg:px-16">
          {STATS.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-3xl font-bold text-brand-600">{stat.value}</p>
              <p className="mt-1 text-sm text-slate-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-screen-2xl px-6 py-16 sm:px-10 lg:px-16 lg:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-8 shadow-sm lg:p-12">
            <h2 className="text-2xl font-bold text-slate-900">Our Mission</h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-600">
              To make professional cleaning accessible, transparent, and
              hassle-free for everyone. Whether you need your driveway
              pressure-washed, your office deep-cleaned, or a full
              end-of-tenancy service, KLEEN makes it simple to get the job done
              right.
            </p>
          </div>

          <h2 className="mt-16 text-center text-2xl font-bold text-slate-900">
            Our Values
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {VALUES.map((value) => {
              const Icon = value.icon;
              return (
                <div
                  key={value.title}
                  className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                >
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${value.gradient} shadow-lg`}
                  >
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-slate-900">
                    {value.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">
                    {value.desc}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-16 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-8 shadow-sm lg:p-12">
            <h2 className="text-2xl font-bold text-slate-900">How We Work</h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-600">
              We connect you with a network of professional, vetted cleaners who
              specialise in exactly what you need. Every job is tracked through
              our platform, so you always know the status of your booking. Our
              real-time pricing engine gives you an honest estimate upfront — no
              hidden fees, no surprises.
            </p>
            <Link
              href={jobFlowHref}
              className="btn-primary mt-6 gap-2"
            >
              Get Started
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
