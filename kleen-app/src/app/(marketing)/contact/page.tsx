import Link from "next/link";
import { Metadata } from "next";
import { ArrowRight, Clock, Mail, MapPin, Phone, Send } from "lucide-react";
import MarketingPageHero, {
  MarketingPageSection,
  marketingCard,
  marketingCardHover,
  marketingCardPanel,
  marketingIconBox,
} from "@/components/marketing/MarketingPageHero";
import { customerAppHref } from "@/lib/customer-app-url";

const jobFlowHref = customerAppHref("/job-flow");

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with the KLEEN team. We're here to help.",
};

const CONTACT_INFO = [
  { icon: Mail, title: "Email", value: "hello@kleen.co.uk" },
  { icon: Phone, title: "Phone", value: "0800 123 4567" },
  { icon: MapPin, title: "Address", value: "KLEEN HQ\nLondon, United Kingdom" },
];

export default function ContactPage() {
  return (
    <>
      <MarketingPageHero
        badge="We're here to help"
        title="Contact us"
        description="Have a question or need help? We'd love to hear from you."
      />

      <MarketingPageSection>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-5 lg:gap-10">
          <div className="lg:col-span-3">
            <div className={marketingCardHover}>
              <div className={marketingCardPanel}>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">Send us a message</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Fill out the form and we&apos;ll get back to you within 24 hours.
                </p>
                <form className="mt-8 space-y-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700">First name</label>
                    <input type="text" className="input-field mt-1.5" placeholder="John" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Last name</label>
                    <input type="text" className="input-field mt-1.5" placeholder="Doe" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Email</label>
                  <input type="email" className="input-field mt-1.5" placeholder="john@example.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Subject</label>
                  <input type="text" className="input-field mt-1.5" placeholder="How can we help?" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Message</label>
                  <textarea
                    className="input-field mt-1.5 min-h-[140px] resize-y"
                    placeholder="Tell us more…"
                  />
                </div>
                <button type="submit" className="btn-primary gap-2 px-6 py-3.5">
                  <Send className="h-4 w-4" />
                  Send message
                </button>
              </form>
              </div>
            </div>
          </div>

          <div className="space-y-5 lg:col-span-2">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Get in touch</h2>
            {CONTACT_INFO.map((info) => {
              const Icon = info.icon;
              return (
                <div key={info.title} className={marketingCardHover}>
                  <div className={`${marketingCardPanel} flex items-start gap-4`}>
                    <div className={marketingIconBox}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{info.title}</h3>
                      <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-500">
                        {info.value}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}

            <div className={marketingCard}>
              <div className={marketingCardPanel}>
                <div className={marketingIconBox}>
                  <Clock className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold text-slate-900">Book on demand</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  Need a clean booked now? Skip the wait — get an instant quote online in under 2
                  minutes and track your job from your dashboard.
                </p>
                <Link
                  href={jobFlowHref}
                  className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
                >
                  Get your free quote
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </MarketingPageSection>
    </>
  );
}
