"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { MarketingPageSection } from "@/components/marketing/MarketingPageHero";

const FAQS = [
  {
    id: "how-it-works",
    q: "How does KLEEN work?",
    a: "Simply click 'Get Started', choose your service, customise the details, and get an instant quote. Once you confirm, we'll match you with a vetted professional cleaner in your area.",
  },
  {
    id: "pricing",
    q: "How is the price calculated?",
    a: "Our real-time pricing engine factors in the type of service, size of the area, complexity of the job, and the number of operatives required. You'll see a price range before you confirm.",
  },
  {
    id: "insurance",
    q: "Are your cleaners insured?",
    a: "Yes. Every cleaner on our platform is fully insured, background-checked, and professionally trained to deliver consistent, high-quality results.",
  },
  {
    q: "Can I reschedule or cancel a job?",
    a: "You can reschedule or cancel via your dashboard. Cancellations made more than 24 hours before the scheduled time are free of charge.",
  },
  {
    q: "What areas do you cover?",
    a: "We're expanding rapidly across the UK. Enter your postcode during the booking process to check availability in your area.",
  },
  {
    q: "How do I pay?",
    a: "Payment is handled securely through our platform. You can pay by card, PayPal, or Klarna. You're only charged once the job is completed.",
  },
  {
    q: "What if I'm not satisfied with the clean?",
    a: "We take quality seriously. If you're not happy, you can raise a dispute through your dashboard and we'll work to resolve it — including a re-clean if necessary.",
  },
  {
    q: "Do you offer commercial cleaning?",
    a: "Yes! We provide cleaning services for offices, retail spaces, warehouses, and other commercial properties. Select 'Commercial' when starting a new job.",
  },
  {
    q: "What services are NOT available?",
    a: "For safety and regulatory reasons, we do not offer: drainage, asbestos removal, roof access/height work, hazardous or biohazard cleanup, crime scene cleanup, or pest control.",
  },
];

export default function FAQAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (!hash) return;
    const index = FAQS.findIndex((faq) => faq.id === hash);
    if (index >= 0) {
      setOpenIndex(index);
      window.setTimeout(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    }
  }, []);

  return (
    <MarketingPageSection>
      <div className="mx-auto max-w-3xl space-y-3">
        {FAQS.map((faq, i) => {
          const isOpen = openIndex === i;
          return (
            <div
              id={faq.id}
              key={faq.q}
              className={[
                "overflow-hidden rounded-[1.5rem] bg-slate-50 transition-all duration-300",
                isOpen ? "bg-white shadow-md" : "hover:bg-white hover:shadow-sm",
              ].join(" ")}
            >
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-4 p-5 text-left sm:p-6"
              >
                <span className="font-semibold text-slate-900">{faq.q}</span>
                <div
                  className={[
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all",
                    isOpen ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-600",
                  ].join(" ")}
                >
                  <ChevronDown
                    className={`h-4 w-4 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
                  />
                </div>
              </button>
              <div
                className={`grid transition-all duration-300 ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
              >
                <div className="overflow-hidden">
                  <div className="px-5 pb-5 pt-0 sm:px-6 sm:pb-6">
                    <p className="leading-relaxed text-slate-600">{faq.a}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mx-auto mt-12 max-w-3xl rounded-[1.5rem] bg-slate-50 p-8 text-center sm:p-10">
        <h3 className="text-xl font-bold text-slate-900 sm:text-2xl">Still have questions?</h3>
        <p className="mt-2 text-slate-500">Our team is happy to help with anything you need.</p>
        <Link href="/contact" className="btn-primary mt-6 inline-flex px-8 py-3.5">
          Contact us
        </Link>
      </div>
    </MarketingPageSection>
  );
}
