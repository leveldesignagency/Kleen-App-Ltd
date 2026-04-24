import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Read the KLEEN privacy policy.",
};

export default function PrivacyPage() {
  return (
    <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <h1 className="text-4xl font-bold tracking-tight text-slate-900">Privacy Policy</h1>
      <p className="mt-2 text-sm text-slate-400">Last updated: February 2026</p>

      <div className="prose mt-8 max-w-none text-slate-600 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-900 [&_p]:mt-3 [&_p]:leading-relaxed [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1">
        <h2>1. Information We Collect</h2>
        <p>We collect information you provide directly:</p>
        <ul>
          <li>Name, email, phone number, and address</li>
          <li>Payment information (processed securely via Stripe)</li>
          <li>Job details and service preferences</li>
          <li>Communications with our support team</li>
        </ul>

        <h2>2. How We Use Your Information</h2>
        <p>We use your information to:</p>
        <ul>
          <li>Provide and improve our cleaning services</li>
          <li>Process bookings and payments</li>
          <li>Communicate about your jobs and account</li>
          <li>Ensure platform safety and prevent fraud</li>
        </ul>

        <h2>3. Data Sharing</h2>
        <p>
          We share relevant job details with assigned cleaning professionals.
          We do not sell your personal data to third parties. We may share data
          with service providers who help us operate the platform (e.g., payment
          processors, hosting providers).
        </p>

        <h2>4. Data Security</h2>
        <p>
          We implement industry-standard security measures to protect your data,
          including encryption in transit and at rest. Payment data is handled
          by PCI-compliant processors.
        </p>

        <h2>5. Your Rights</h2>
        <p>
          Under GDPR, you have the right to access, correct, delete, or export
          your personal data. Contact us at privacy@kleen.co.uk to exercise
          these rights.
        </p>

        <h2>6. Cookies</h2>
        <p>
          We use essential cookies for authentication and platform functionality.
          Analytics cookies are used only with your consent.
        </p>

        <h2>7. Contact</h2>
        <p>
          For privacy-related inquiries, contact our Data Protection Officer at
          privacy@kleen.co.uk.
        </p>
      </div>
    </section>
  );
}
