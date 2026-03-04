import Link from "next/link";
import HeroImages from "@/components/ui/HeroImages";
import HeroBubbles from "@/components/ui/HeroBubbles";
import {
  ArrowRight,
  Shield,
  Clock,
  Star,
  Sparkles,
  Home,
  Building2,
  Car,
  TreePine,
  Trash2,
  ChefHat,
  CloudRain,
  Key,
  CheckCircle2,
} from "lucide-react";

const TRUST_SIGNALS = [
  { icon: Shield, title: "Fully Insured", desc: "Complete peace of mind with comprehensive insurance coverage" },
  { icon: Clock, title: "Flexible Scheduling", desc: "Book at times that suit you, 7 days a week" },
  { icon: Star, title: "5-Star Rated", desc: "Consistently rated excellent by our customers" },
  { icon: CheckCircle2, title: "Vetted Cleaners", desc: "Background-checked and professionally trained" },
];

const SERVICE_HIGHLIGHTS = [
  { icon: Home, name: "Exterior Cleaning", desc: "Driveways, patios, decking & more" },
  { icon: Sparkles, name: "Interior Cleaning", desc: "Full house and room-by-room" },
  { icon: CloudRain, name: "Gutter & Roofline", desc: "Clearing and deep cleaning" },
  { icon: ChefHat, name: "Kitchen", desc: "Oven, hob & full kitchen" },
  { icon: Key, name: "End-of-Tenancy", desc: "Move-out deep cleans" },
  { icon: Car, name: "Vehicle Cleaning", desc: "Interior & exterior valeting" },
  { icon: TreePine, name: "Garden", desc: "Tidying, lawn care & clearance" },
  { icon: Building2, name: "Commercial", desc: "Offices, retail & warehouses" },
  { icon: Trash2, name: "Waste Removal", desc: "Collection & disposal" },
];

const STEPS = [
  { num: "01", title: "Tell Us What You Need", desc: "Choose your service and customise the details" },
  { num: "02", title: "Get an Instant Quote", desc: "See real-time pricing based on your requirements" },
  { num: "03", title: "Confirm & Relax", desc: "We handle the rest — track everything from your dashboard" },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative -mt-[5.25rem] flex min-h-screen overflow-hidden bg-gradient-to-br from-slate-900 via-brand-950 to-slate-900">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(6,182,212,0.15),_transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(16,185,129,0.1),_transparent_60%)]" />
        <HeroBubbles />
        <div className="relative mx-auto flex w-full max-w-screen-2xl items-center px-6 pb-28 pt-40 sm:px-10 sm:pb-36 sm:pt-44 lg:px-16 lg:pb-44 lg:pt-52">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-400/20 bg-brand-500/10 px-4 py-1.5 text-sm text-brand-300">
              <Sparkles className="h-3.5 w-3.5" />
              Professional cleaning, simplified
            </div>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Cleaning made{" "}
              <span className="bg-gradient-to-r from-brand-400 to-accent-400 bg-clip-text text-transparent">
                effortless
              </span>
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-slate-300">
              From driveways to deep cleans, KLEEN connects you with trusted professionals.
              Get an instant quote, book online, and manage everything from one place.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link href="/job-flow" className="btn-primary gap-2 px-8 py-4 text-base">
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/services" className="btn-secondary gap-2 border-slate-700 bg-transparent px-8 py-4 text-base text-white hover:bg-slate-800">
                View Services
              </Link>
            </div>
          </div>
          <div className="hidden flex-1 lg:block">
            <HeroImages />
          </div>
        </div>
      </section>

      {/* Trust Signals */}
      <section className="border-b border-slate-100 bg-white">
        <div className="mx-auto max-w-screen-2xl px-6 py-12 sm:px-10 lg:px-16">
          <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
            {TRUST_SIGNALS.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50">
                    <Icon className="h-6 w-6 text-brand-600" />
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-1 text-xs text-slate-500">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Services Grid */}
      <section className="bg-slate-50 px-6 py-16 sm:px-10 lg:px-16 lg:py-24">
        <div className="mx-auto max-w-screen-2xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Our Services
            </h2>
            <p className="mt-3 text-slate-500">
              Comprehensive cleaning solutions for every need
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICE_HIGHLIGHTS.map((service) => {
              const Icon = service.icon;
              return (
                <div
                  key={service.name}
                  className="group card flex items-start gap-4 transition-shadow hover:shadow-md"
                >
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 transition-colors group-hover:bg-brand-100">
                    <Icon className="h-5 w-5 text-brand-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{service.name}</h3>
                    <p className="mt-0.5 text-xs text-slate-500">{service.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-10 text-center">
            <Link href="/services" className="btn-secondary">
              View All Services
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-white px-6 py-16 sm:px-10 lg:px-16 lg:py-24">
        <div className="mx-auto max-w-screen-2xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              How It Works
            </h2>
            <p className="mt-3 text-slate-500">Three simple steps to a cleaner space</p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.num} className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 text-lg font-bold text-white shadow-lg shadow-brand-600/25">
                  {step.num}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-2 text-sm text-slate-500">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-br from-brand-600 to-brand-700">
        <div className="mx-auto max-w-screen-2xl px-6 py-16 text-center sm:px-10 lg:px-16 lg:py-20">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Ready to get started?
          </h2>
          <p className="mt-3 text-lg text-brand-100">
            Get an instant quote in under 2 minutes. No obligation.
          </p>
          <div className="mt-8">
            <Link
              href="/job-flow"
              className="btn-secondary gap-2 border-white/20 bg-white px-8 py-4 text-base text-brand-700 shadow-lg hover:bg-brand-50"
            >
              Get Your Free Quote
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
