import { Metadata } from "next";
import Link from "next/link";
import MarketingPageHero, {
  MarketingPageSection,
  marketingCard,
  marketingCardPanel,
} from "@/components/marketing/MarketingPageHero";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms governing use of the Kleen marketplace platform.",
};

export default function TermsPage() {
  return (
    <>
      <MarketingPageHero
        badge="Legal"
        title="Terms of service"
        description="The terms that govern your use of the Kleen platform."
        compact
      />

      <MarketingPageSection>
        <div className={`mx-auto max-w-3xl ${marketingCard}`}>
          <div className={marketingCardPanel}>
            <p className="text-sm font-medium text-slate-400">Last updated: 25 August 2026</p>

            <div className="prose mt-8 max-w-none text-slate-600 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-900 [&_p]:mt-3 [&_p]:leading-relaxed [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1">
              <h2>1. Agreement</h2>
              <p>
                These Terms of Service (“Terms”) are a contract between you and{" "}
                <strong>Kleen App Ltd</strong> (“Kleen”, “we”, “us”) for use of kleenapp.co.uk and related
                apps (customer, contractor, and admin portals). By creating an account or using the Service
                you agree to these Terms and our{" "}
                <Link href="/privacy" className="text-brand-600 underline">
                  Privacy Policy
                </Link>
                .
              </p>

              <h2>2. Marketplace role</h2>
              <p>
                Kleen operates an online <strong>marketplace</strong> that connects customers with
                independent cleaning contractors. Unless we expressly state otherwise in writing, Kleen is
                not the cleaning provider. Contractors are responsible for the quality, timing, and lawful
                performance of their work. Kleen provides tooling for discovery, quoting, booking,
                messaging, escrow-style payment handling, and dispute facilitation.
              </p>

              <h2>3. Accounts</h2>
              <p>
                You must provide accurate information and keep credentials secure. You are responsible for
                activity under your account. We may suspend or terminate accounts for breach of these Terms,
                fraud risk, or safety concerns.
              </p>

              <h2>4. Bookings, quotes, and payments (escrow)</h2>
              <ul>
                <li>Prices and ranges shown before booking may be estimates; accepted quotes set the booking price subject to the quote terms.</li>
                <li>
                  When a customer accepts a quote, payment is typically <strong>authorised and held</strong>{" "}
                  (via Stripe) until the job is completed and release rules are met, including any dispute
                  window we publish in-product.
                </li>
                <li>
                  Kleen may deduct platform fees before contractor payout. Payouts to contractors use Stripe
                  Connect where configured.
                </li>
                <li>
                  Chargebacks, refunds, and partial releases are handled according to Stripe rules, these
                  Terms, and any dispute outcome.
                </li>
              </ul>

              <h2>5. Cancellations</h2>
              <p>
                Cancellation rights and any fees depend on job status and timing. Late cancellations may
                incur fees as shown in-product or in the applicable quote/contract. Cancelled jobs do not
                erase our right to retain records as described in §10 and the Privacy Policy.
              </p>

              <h2>6. Disputes</h2>
              <p>
                Customers and contractors should first use in-app dispute and support tools. Kleen may
                mediate, request evidence, pause fund release, or take other reasonable steps. Kleen’s
                involvement does not make Kleen a party to the underlying cleaning contract unless required
                by law. Nothing in these Terms prevents reporting criminal matters to the police.
              </p>

              <h2>7. Prohibited conduct</h2>
              <p>You must not:</p>
              <ul>
                <li>Use the Service for unlawful activity, fraud, money laundering, or identity misuse</li>
                <li>Harass, threaten, discriminate against, or exploit others</li>
                <li>Upload malware, scrape without permission, or bypass security / access controls</li>
                <li>Misrepresent identity, insurance, qualifications, or job conditions</li>
                <li>Solicit off-platform payment to avoid fees where that breaches your agreement with Kleen</li>
                <li>Request or perform prohibited services (including drainage, asbestos, roof/height work, hazardous/biohazard or crime-scene cleanup, or pest control)</li>
              </ul>
              <p>
                We may investigate, retain relevant records under a legal hold, cooperate with authorities,
                and suspend accounts.
              </p>

              <h2>8. Contractor obligations</h2>
              <p>
                Contractors must complete onboarding, keep documents accurate, hold required insurance where
                applicable, perform work professionally, and use field status tools honestly. Vetting
                documents are retained and deleted according to our Privacy Policy.
              </p>

              <h2>9. Liability</h2>
              <p>
                To the fullest extent permitted by law, Kleen is not liable for contractor workmanship,
                property damage caused by contractors, or disputes between users, except where we fail to
                provide the platform with reasonable care and skill or where liability cannot be excluded
                (including death/personal injury caused by negligence, or fraud). Our aggregate liability
                for platform-related claims in any 12-month period is limited to the greater of (a) fees you
                paid to Kleen for the relevant bookings in that period and (b) £100, except where prohibited.
              </p>

              <h2>10. Records, fraud, and legal claims</h2>
              <p>
                We retain anonymised or limited records of jobs, payments (including Stripe identifiers), and
                disputes for tax, accounting, fraud prevention, safety, and legal claims, as described in the
                Privacy Policy. Account deletion removes login and identifiable profile data subject to those
                exceptions and any active legal hold.
              </p>

              <h2>11. Intellectual property</h2>
              <p>
                Kleen branding, software, and content remain ours or our licensors’. You may not copy or
                reverse engineer the Service except as allowed by law.
              </p>

              <h2>12. Changes</h2>
              <p>
                We may update these Terms. Continued use after the updated “Last updated” date constitutes
                acceptance, except where we are required to obtain fresh consent.
              </p>

              <h2>13. Governing law</h2>
              <p>
                These Terms are governed by the laws of <strong>England and Wales</strong>. Courts of England
                and Wales have exclusive jurisdiction, without prejudice to mandatory consumer protections
                that apply where you live.
              </p>

              <h2>14. Contact</h2>
              <p>
                Legal:{" "}
                <a href="mailto:legal@kleenapp.co.uk" className="text-brand-600 underline">
                  legal@kleenapp.co.uk
                </a>
                <br />
                Privacy:{" "}
                <a href="mailto:privacy@kleenapp.co.uk" className="text-brand-600 underline">
                  privacy@kleenapp.co.uk
                </a>
                <br />
                General:{" "}
                <a href="mailto:info@kleenapp.co.uk" className="text-brand-600 underline">
                  info@kleenapp.co.uk
                </a>
              </p>
            </div>
          </div>
        </div>
      </MarketingPageSection>
    </>
  );
}
