import { Metadata } from "next";
import Link from "next/link";
import MarketingPageHero, {
  MarketingPageSection,
  marketingCard,
  marketingCardPanel,
} from "@/components/marketing/MarketingPageHero";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Kleen collects, uses, retains, and protects personal data (UK GDPR).",
};

export default function PrivacyPage() {
  return (
    <>
      <MarketingPageHero
        badge="Legal"
        title="Privacy policy"
        description="How we collect, use, retain, and protect your personal information."
        compact
      />

      <MarketingPageSection>
        <div className={`mx-auto max-w-3xl ${marketingCard}`}>
          <div className={marketingCardPanel}>
            <p className="text-sm font-medium text-slate-400">Last updated: 25 August 2026</p>

            <div className="prose mt-8 max-w-none text-slate-600 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-900 [&_h3]:mt-5 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-slate-800 [&_p]:mt-3 [&_p]:leading-relaxed [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1 [&_table]:mt-4 [&_th]:text-left [&_td]:align-top [&_td]:py-2 [&_th]:py-2">
              <h2>1. Who we are (controller)</h2>
              <p>
                The data controller is <strong>Kleen App Ltd</strong> (trading as <strong>Kleen</strong>),
                operating kleenapp.co.uk and related apps (customer dashboard, contractor portal, admin).
              </p>
              <p>
                Privacy contact:{" "}
                <a href="mailto:privacy@kleenapp.co.uk" className="text-brand-600 underline">
                  privacy@kleenapp.co.uk
                </a>
                . We do not currently appoint a separate external DPO; privacy requests are handled by
                our data protection contact at that address.
              </p>

              <h2>2. Personal data we collect</h2>
              <ul>
                <li>Identity and contact: name, email, phone, account role (customer / contractor / admin)</li>
                <li>Address and job details for cleaning bookings</li>
                <li>Payment and payout data via Stripe (we do not store full card numbers)</li>
                <li>Contractor onboarding: business details, service areas, ID documents for vetting</li>
                <li>Communications: support messages, dispute threads, transactional emails</li>
                <li>Technical: IP/security logs, auth cookies, device/browser needed to run the service</li>
              </ul>

              <h2>3. Purposes and lawful bases (UK GDPR)</h2>
              <ul>
                <li>
                  <strong>Contract</strong> — create accounts, match jobs, quotes, escrow payments, contractor
                  onboarding, deliver the marketplace service.
                </li>
                <li>
                  <strong>Legitimate interests</strong> — platform safety, fraud prevention, service improvement,
                  defending legal claims, securing our systems (balanced against your rights).
                </li>
                <li>
                  <strong>Legal obligation</strong> — tax/accounting records, responding to lawful requests.
                </li>
                <li>
                  <strong>Consent</strong> — non-essential cookies/analytics (if enabled), optional marketing
                  where consent is required. You can withdraw consent at any time.
                </li>
              </ul>

              <h2>4. Processors and sharing</h2>
              <p>We use specialist providers under contract. We do not sell your personal data.</p>
              <ul>
                <li>
                  <strong>Supabase</strong> — database, authentication, file storage (jobs evidence, contractor documents)
                </li>
                <li>
                  <strong>Stripe</strong> — payments, escrow/authorisations, contractor Connect payouts
                </li>
                <li>
                  <strong>Resend</strong> — transactional email
                </li>
                <li>
                  <strong>Vercel</strong> — application hosting and edge delivery
                </li>
              </ul>
              <p>
                Relevant job details are shared with contractors who quote or are booked. We may share data with
                professional advisers or authorities where required by law or to protect rights, safety, or fraud
                prevention.
              </p>

              <h2>5. International transfers</h2>
              <p>
                Some providers may process data outside the UK. Where that happens, we rely on appropriate
                safeguards (for example UK adequacy regulations or standard contractual clauses / equivalent
                transfer tools offered by the provider). Details are available on request.
              </p>

              <h2>6. How long we keep data (retention)</h2>
              <p>
                Summary below. The full internal matrix is maintained for staff as{" "}
                <em>Data retention matrix</em> (aligned with this policy). Periods may be extended only under a
                documented <strong>legal hold</strong> (see §8).
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-800">
                      <th>Category</th>
                      <th>Typical period</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-100">
                      <td>Account profile</td>
                      <td>While account is active</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td>Account deletion grace</td>
                      <td>30 days after you request erase (cancelable in-app)</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td>Job &amp; payment ledgers (anonymised after erase)</td>
                      <td>Up to 6 years (tax / accounting / claims)</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td>Disputes / chargebacks</td>
                      <td>Up to 6 years from relevant event</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td>Contractor ID / vetting documents</td>
                      <td>Up to 24 months after leave/erase, unless legal hold</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td>Support correspondence</td>
                      <td>Typically 2–3 years</td>
                    </tr>
                    <tr>
                      <td>Marketing preferences</td>
                      <td>Until withdrawn or account erased</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h2>7. Account deletion and anonymisation</h2>
              <p>
                You can schedule account deletion from your dashboard (Account settings). After the 30-day
                grace period we:
              </p>
              <ul>
                <li>Remove your login and scrub profile identifiers</li>
                <li>
                  Anonymise job records (redact full address/notes; keep job reference, status timeline, outward
                  postcode area, and payment amounts / Stripe IDs needed for ledgers)
                </li>
                <li>Delete stored payment methods and saved addresses</li>
                <li>
                  For contractors, start the document retention countdown; ID files are purged when that period
                  ends unless a legal hold applies
                </li>
              </ul>
              <p>
                Deletion may be delayed if an active legal hold applies. Contact{" "}
                <a href="mailto:privacy@kleenapp.co.uk" className="text-brand-600 underline">
                  privacy@kleenapp.co.uk
                </a>{" "}
                for help.
              </p>

              <h2>8. Fraud, safety, and legal claims (legal holds)</h2>
              <p>
                Where reasonably necessary for fraud prevention, safety, establishing or defending legal claims,
                or regulatory/lawful requests, we may place a <strong>legal hold</strong> on a user, contractor,
                or job. Access is restricted to authorised admin/legal staff. Holds are purpose-limited and
                reviewed; they are not a blanket reason to keep all personal data forever. When a hold is
                released, normal retention and erasure rules apply.
              </p>
              <p>
                We prefer anonymised job ledgers plus payment provider references and timestamps over keeping
                full identifiable profiles indefinitely.
              </p>

              <h2>9. Contractor documents</h2>
              <p>
                ID and vetting documents are stored in private storage, accessible to the contractor and
                authorised Kleen admins (signed URLs). They are retained only as long as needed for vetting,
                safety, and the periods above, then deleted from storage unless a legal hold applies.
              </p>

              <h2>10. Your rights</h2>
              <p>Under UK GDPR you may have the right to:</p>
              <ul>
                <li>Access your personal data</li>
                <li>Rectify inaccurate data</li>
                <li>Erase data (subject to legal exceptions such as tax or legal claims)</li>
                <li>Restrict or object to certain processing</li>
                <li>Data portability (where applicable)</li>
                <li>Withdraw consent where processing is consent-based</li>
                <li>Complain to the ICO (ico.org.uk)</li>
              </ul>
              <p>
                To exercise rights, email{" "}
                <a href="mailto:privacy@kleenapp.co.uk" className="text-brand-600 underline">
                  privacy@kleenapp.co.uk
                </a>{" "}
                from your account email (or with enough detail for us to verify you). We respond within one
                month where required by law.
              </p>

              <h2>11. Cookies</h2>
              <p>
                We use essential cookies for security and sign-in. Non-essential analytics cookies are used
                only if you opt in. See our{" "}
                <Link href="/cookies" className="text-brand-600 underline">
                  Cookie policy
                </Link>
                .
              </p>

              <h2>12. Children</h2>
              <p>Kleen is not directed at children under 18. We do not knowingly collect their data.</p>

              <h2>13. Changes</h2>
              <p>
                We may update this policy. The “Last updated” date will change; material changes may also be
                notified in-product or by email where appropriate.
              </p>

              <h2>14. Contact</h2>
              <p>
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
