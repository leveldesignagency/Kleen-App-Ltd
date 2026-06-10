import { Metadata } from "next";
import { Shield, Heart, Leaf, Award, Sparkles } from "lucide-react";
import AboutStorySection from "@/components/marketing/AboutStorySection";
import MarketingFeatureCard from "@/components/marketing/MarketingFeatureCard";
import MarketingPageHero, {
  MarketingPageSection,
  MarketingStatGrid,
} from "@/components/marketing/MarketingPageHero";
import { customerAppHref } from "@/lib/customer-app-url";

const jobFlowHref = customerAppHref("/job-flow");

export const metadata: Metadata = {
  title: "About Us",
  description: "Learn about KLEEN — our mission, values, and commitment to quality cleaning.",
};

const VALUES = [
  {
    icon: Shield,
    title: "Trust & reliability",
    desc: "Every cleaner is vetted, insured, and held to the highest professional standards.",
  },
  {
    icon: Heart,
    title: "Customer first",
    desc: "Your satisfaction drives everything we do. We're not happy until you are.",
  },
  {
    icon: Leaf,
    title: "Eco-conscious",
    desc: "We use environmentally responsible products and methods wherever possible.",
  },
  {
    icon: Award,
    title: "Quality assured",
    desc: "Consistent, high-quality results backed by our satisfaction guarantee.",
  },
];

const STATS = [
  { value: "5,000+", label: "Jobs completed" },
  { value: "98%", label: "Satisfaction rate" },
  { value: "200+", label: "Vetted cleaners" },
  { value: "50+", label: "Areas covered" },
];

export default function AboutPage() {
  return (
    <>
      <MarketingPageHero
        badge="Our story"
        title="About KLEEN"
        description="Making professional cleaning accessible, transparent, and available whenever you need it."
      />

      <AboutStorySection />

      <MarketingPageSection>
        <MarketingStatGrid stats={STATS} />

        <div className="mt-14">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Our values</h2>
            <p className="mt-3 text-slate-500">What guides every job on the platform.</p>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:gap-6">
            {VALUES.map((value) => {
              const Icon = value.icon;
              return (
                <MarketingFeatureCard
                  key={value.title}
                  icon={Icon}
                  title={value.title}
                  description={value.desc}
                />
              );
            })}
          </div>
        </div>

        <MarketingFeatureCard
          icon={Sparkles}
          title="How we work"
          description="We connect you with a network of professional, vetted cleaners who specialise in exactly what you need. Every job is tracked through our platform, and our real-time pricing engine gives you an honest estimate upfront — no hidden fees, no surprises."
          href={jobFlowHref}
          linkLabel="Get started"
          featured
          className="mt-14"
        />
      </MarketingPageSection>
    </>
  );
}
