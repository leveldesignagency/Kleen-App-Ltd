import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";

const SERVICES = [
  { title: "Exterior cleaning", image: "exterior clean.jpg" },
  { title: "Interior deep clean", image: "interior clean.jpg" },
  { title: "End-of-tenancy", image: "end of tenancy.png" },
] as const;

function publicImageSrc(filename: string) {
  return `/${encodeURIComponent(filename)}`;
}

export default function HomeServicesSection() {
  return (
    <section className="relative bg-white pt-12 sm:pt-16 lg:pt-20">
      <div className="mx-auto max-w-screen-2xl py-16 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-1.5 text-sm font-semibold text-brand-700">
            <CheckCircle2 className="h-4 w-4" />
            Our services
          </div>
          <h2 className="mt-5 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
            Cleaning for every{" "}
            <span className="bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent">
              space and surface
            </span>
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-500">
            From quick refreshes to specialist deep cleans — transparent pricing, trusted operatives,
            tracked from your dashboard.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
          {SERVICES.map((service) => (
            <div
              key={service.title}
              className="group overflow-hidden rounded-[1.5rem] bg-slate-50 shadow-sm transition-all duration-300 hover:-translate-y-2 hover:scale-[1.02] hover:shadow-lg hover:shadow-slate-900/10"
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image
                  src={publicImageSrc(service.image)}
                  alt={service.title}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
              </div>
              <div className="p-5 sm:p-6">
                <h3 className="text-lg font-bold text-slate-900 transition-colors group-hover:text-brand-700">
                  {service.title}
                </h3>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link href="/services" className="btn-primary gap-2 px-8 py-4 text-base">
            View all services
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
