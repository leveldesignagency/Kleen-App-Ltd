import { Metadata } from "next";
import Link from "next/link";
import MarketingPageHero, {
  MarketingPageSection,
  marketingCard,
  marketingCardPanel,
} from "@/components/marketing/MarketingPageHero";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "How Kleen uses cookies and similar technologies.",
};

export default function CookiesPage() {
  return (
    <>
      <MarketingPageHero
        badge="Legal"
        title="Cookie policy"
        description="Essential cookies, optional analytics, and how to manage your choice."
        compact
      />

      <MarketingPageSection>
        <div className={`mx-auto max-w-3xl ${marketingCard}`}>
          <div className={marketingCardPanel}>
            <p className="text-sm font-medium text-slate-400">Last updated: 25 August 2026</p>

            <div className="prose mt-8 max-w-none text-slate-600 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-900 [&_p]:mt-3 [&_p]:leading-relaxed [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1">
              <h2>1. What are cookies?</h2>
              <p>
                Cookies are small files stored on your device. We also use similar technologies (local
                storage) for consent preferences.
              </p>

              <h2>2. Essential cookies (always on)</h2>
              <p>These are required for the Service to work securely:</p>
              <ul>
                <li>Authentication / session (Supabase auth)</li>
                <li>Security and rate-limiting related preferences</li>
                <li>Site access / preview gate where enabled</li>
                <li>Cookie consent preference itself</li>
              </ul>
              <p>These do not require consent under PECR / UK rules for strictly necessary cookies.</p>

              <h2>3. Non-essential / analytics</h2>
              <p>
                We may use optional analytics to understand product usage.{" "}
                <strong>These are not loaded unless you choose “Accept analytics”</strong> in the cookie
                banner. Today, if no analytics provider is configured, accepting analytics only stores your
                preference for when analytics are enabled.
              </p>

              <h2>4. Managing your choice</h2>
              <p>
                Use the banner on first visit, or clear site data / revisit after deleting the{" "}
                <code>kleen_cookie_consent</code> cookie. You can also control cookies in your browser
                settings. See our{" "}
                <Link href="/privacy" className="text-brand-600 underline">
                  Privacy Policy
                </Link>
                .
              </p>

              <h2>5. Contact</h2>
              <p>
                <a href="mailto:privacy@kleenapp.co.uk" className="text-brand-600 underline">
                  privacy@kleenapp.co.uk
                </a>
              </p>
            </div>
          </div>
        </div>
      </MarketingPageSection>
    </>
  );
}
