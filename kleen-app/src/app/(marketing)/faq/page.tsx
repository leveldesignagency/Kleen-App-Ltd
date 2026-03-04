"use client";

import { useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import Link from "next/link";

const FAQS = [
  {
    q: "How does KLEEN work?",
    a: "Simply click 'Get Started', choose your service, customise the details, and get an instant quote. Once you confirm, we'll match you with a vetted professional cleaner in your area.",
  },
  {
    q: "How is the price calculated?",
    a: "Our real-time pricing engine factors in the type of service, size of the area, complexity of the job, and the number of operatives required. You'll see a price range before you confirm.",
  },
  {
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
    a: "Payment is handled securely through our platform. You can pay by card, PayPal, or Klarna (pay later or in 3 instalments). You're only charged once the job is completed.",
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

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <>
      <section className="relative -mt-[5.25rem] overflow-hidden bg-gradient-to-br from-slate-900 via-brand-950 to-slate-900">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(6,182,212,0.15),_transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(16,185,129,0.1),_transparent_60%)]" />
        <div className="relative mx-auto max-w-screen-2xl px-6 pb-20 pt-32 sm:px-10 lg:px-16 lg:pb-28 lg:pt-40">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-400/20 bg-brand-500/10 px-4 py-1.5 text-sm text-brand-300">
              <Sparkles className="h-3.5 w-3.5" />
              Got questions?
            </div>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Frequently Asked Questions
            </h1>
            <p className="mt-4 text-lg text-slate-300">
              Everything you need to know about KLEEN
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16 sm:px-10 lg:px-16 lg:py-24">
        <div className="space-y-3">
          {FAQS.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <div
                key={i}
                className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-300 ${
                  isOpen
                    ? "border-brand-200 shadow-md shadow-brand-100/40"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="flex w-full items-center justify-between p-5 text-left transition-colors hover:bg-slate-50"
                >
                  <span className="pr-4 font-semibold text-slate-900">
                    {faq.q}
                  </span>
                  <div
                    className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-all ${
                      isOpen
                        ? "bg-brand-100 text-brand-600"
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    <ChevronDown
                      className={`h-4 w-4 transition-transform duration-300 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </button>
                <div
                  className={`grid transition-all duration-300 ${
                    isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="border-t border-slate-100 px-5 pb-5 pt-3">
                      <p className="leading-relaxed text-slate-600">
                        {faq.a}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-12 rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white p-8 text-center">
          <h3 className="text-lg font-bold text-slate-900">
            Still have questions?
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            Our team is happy to help with anything you need.
          </p>
          <Link href="/contact" className="btn-primary mt-4 inline-flex">
            Contact Us
          </Link>
        </div>
      </section>
    </>
  );
}
