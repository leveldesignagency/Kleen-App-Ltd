import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Read the KLEEN terms of service.",
};

export default function TermsPage() {
  return (
    <section className="mx-auto max-w-4xl px-6 py-16 sm:px-10 lg:px-16 lg:py-24">
      <h1 className="text-4xl font-bold tracking-tight text-slate-900">Terms of Service</h1>
      <p className="mt-2 text-sm text-slate-400">Last updated: February 2026</p>

      <div className="prose mt-8 max-w-none text-slate-600 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-900 [&_p]:mt-3 [&_p]:leading-relaxed">
        <h2>1. Acceptance of Terms</h2>
        <p>
          By accessing or using the KLEEN platform (&quot;Service&quot;), you agree to be bound
          by these Terms of Service. If you do not agree, please do not use our Service.
        </p>

        <h2>2. Service Description</h2>
        <p>
          KLEEN provides an online platform connecting customers with professional
          cleaning service providers. We facilitate booking, payment, and communication
          between customers and cleaners.
        </p>

        <h2>3. User Accounts</h2>
        <p>
          You must provide accurate information when creating an account. You are
          responsible for maintaining the security of your account credentials and for
          all activity under your account.
        </p>

        <h2>4. Bookings & Payments</h2>
        <p>
          Prices shown are estimates. Final pricing may vary based on actual job
          conditions. Payment is processed upon job completion. Cancellations made less
          than 24 hours before a scheduled job may incur a fee.
        </p>

        <h2>5. Prohibited Services</h2>
        <p>
          KLEEN does not offer drainage, asbestos removal, roof access or height work,
          hazardous or biohazard cleanup, crime scene cleanup, or pest control services.
        </p>

        <h2>6. Liability</h2>
        <p>
          While we vet all cleaners on our platform, KLEEN acts as a marketplace and
          is not directly liable for the quality of work performed. Disputes can be
          raised through your dashboard.
        </p>

        <h2>7. Changes to Terms</h2>
        <p>
          We may update these terms from time to time. Continued use of the platform
          after changes constitutes acceptance of the updated terms.
        </p>

        <h2>8. Contact</h2>
        <p>
          For questions about these terms, contact us at legal@kleen.co.uk.
        </p>
      </div>
    </section>
  );
}
