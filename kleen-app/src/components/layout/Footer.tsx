import Link from "next/link";
import Image from "next/image";

const FOOTER_LINKS = {
  Services: [
    { href: "/services", label: "All Services" },
    { href: "/job-flow", label: "Get a Quote" },
    { href: "/faq", label: "FAQ" },
  ],
  Company: [
    { href: "/about", label: "About Us" },
    { href: "/contact", label: "Contact" },
    { href: "/contractors", label: "Contractors & cleaners" },
  ],
  Legal: [
    { href: "/terms", label: "Terms of Service" },
    { href: "/privacy", label: "Privacy Policy" },
  ],
};

export default function Footer() {
  return (
    <footer className="border-t border-slate-100 bg-slate-50">
      <div className="mx-auto max-w-screen-2xl px-6 py-12 sm:px-10 lg:px-16">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center">
              <Image
                src="/images/kleen-logo.svg"
                alt="KLEEN"
                width={140}
                height={58}
                className="h-12 w-auto"
              />
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-slate-500">
              Professional cleaning services for homes and businesses. Quality you can trust.
            </p>
          </div>

          {Object.entries(FOOTER_LINKS).map(([heading, links]) => (
            <div key={heading}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {heading}
              </h3>
              <ul className="mt-3 space-y-2">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-slate-600 transition-colors hover:text-brand-600"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 border-t border-slate-200 pt-6 text-center text-xs text-slate-400">
          &copy; {new Date().getFullYear()} KLEEN. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
