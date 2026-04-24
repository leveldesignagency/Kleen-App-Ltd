import { Metadata } from "next";
import { Mail, MapPin, Phone, Sparkles, Send } from "lucide-react";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with the KLEEN team. We're here to help.",
};

const CONTACT_INFO = [
  {
    icon: Mail,
    title: "Email",
    value: "hello@kleen.co.uk",
    gradient: "from-brand-500 to-cyan-500",
  },
  {
    icon: Phone,
    title: "Phone",
    value: "0800 123 4567",
    gradient: "from-emerald-500 to-teal-500",
  },
  {
    icon: MapPin,
    title: "Address",
    value: "KLEEN HQ\nLondon, United Kingdom",
    gradient: "from-violet-500 to-purple-500",
  },
];

export default function ContactPage() {
  return (
    <>
      <section className="relative -mt-[5.25rem] overflow-hidden bg-gradient-to-br from-slate-900 via-brand-950 to-slate-900">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(6,182,212,0.15),_transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(16,185,129,0.1),_transparent_60%)]" />
        <div className="relative mx-auto max-w-screen-2xl px-4 pb-20 pt-32 sm:px-6 lg:px-8 lg:pb-28 lg:pt-40">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-400/20 bg-brand-500/10 px-4 py-1.5 text-sm text-brand-300">
              <Sparkles className="h-3.5 w-3.5" />
              We&apos;re here to help
            </div>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Contact Us
            </h1>
            <p className="mt-4 text-lg text-slate-300">
              Have a question or need help? We&apos;d love to hear from you.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-screen-2xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-5">
          {/* Form */}
          <div className="lg:col-span-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-2xl font-bold text-slate-900">
                Send Us a Message
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Fill out the form and we&apos;ll get back to you within 24 hours.
              </p>
              <form className="mt-6 space-y-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      First Name
                    </label>
                    <input
                      type="text"
                      className="input-field mt-1"
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      Last Name
                    </label>
                    <input
                      type="text"
                      className="input-field mt-1"
                      placeholder="Doe"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Email
                  </label>
                  <input
                    type="email"
                    className="input-field mt-1"
                    placeholder="john@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Subject
                  </label>
                  <input
                    type="text"
                    className="input-field mt-1"
                    placeholder="How can we help?"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Message
                  </label>
                  <textarea
                    className="input-field mt-1 min-h-[140px] resize-y"
                    placeholder="Tell us more..."
                  />
                </div>
                <button
                  type="submit"
                  className="btn-primary gap-2 px-6 py-3"
                >
                  <Send className="h-4 w-4" />
                  Send Message
                </button>
              </form>
            </div>
          </div>

          {/* Info cards */}
          <div className="space-y-5 lg:col-span-2">
            <h2 className="text-2xl font-bold text-slate-900">Get In Touch</h2>
            {CONTACT_INFO.map((info) => {
              const Icon = info.icon;
              return (
                <div
                  key={info.title}
                  className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${info.gradient} shadow-lg`}
                    >
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        {info.title}
                      </h3>
                      <p className="mt-1 whitespace-pre-line text-sm text-slate-500">
                        {info.value}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Hours card */}
            <div className="rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white p-5">
              <h3 className="font-semibold text-brand-700">Opening Hours</h3>
              <div className="mt-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Mon – Fri</span>
                  <span className="font-medium text-slate-700">
                    8:00am – 6:00pm
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Saturday</span>
                  <span className="font-medium text-slate-700">
                    9:00am – 4:00pm
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Sunday</span>
                  <span className="font-medium text-slate-400">Closed</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
