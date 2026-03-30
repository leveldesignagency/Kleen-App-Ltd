"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useContractorPortal } from "@/components/contractor/contractor-portal-context";
import { FileText, Landmark, Briefcase, UserRound, ShieldAlert, CheckCircle2, Circle } from "lucide-react";

type OnboardingStep = { label: string; done: boolean; href?: string };

export default function ContractorHomePage() {
  const { operativeId, isVerified, rejectionMessage } = useContractorPortal();
  const [stripeId, setStripeId] = useState<string | null>(null);
  const [serviceCount, setServiceCount] = useState<number | null>(null);
  const [onboardingSteps, setOnboardingSteps] = useState<OnboardingStep[] | null>(null);

  useEffect(() => {
    if (!operativeId) return;
    const supabase = createClient();
    (async () => {
      const { data: op } = await supabase
        .from("operatives")
        .select(
          "stripe_account_id, phone, service_areas, trading_name, registered_address, company_name"
        )
        .eq("id", operativeId)
        .single();
      setStripeId(op?.stripe_account_id || null);

      const { count } = await supabase
        .from("operative_services")
        .select("id", { count: "exact", head: true })
        .eq("operative_id", operativeId);
      const n = count ?? 0;
      setServiceCount(n);

      const areas = Array.isArray(op?.service_areas) ? op!.service_areas.length : 0;
      const phoneOk = !!(op?.phone && String(op.phone).trim());
      const ukOk = !!(
        (op?.company_name && String(op.company_name).trim()) ||
        (op?.trading_name && String(op.trading_name).trim()) ||
        (op?.registered_address && String(op.registered_address).trim())
      );
      setOnboardingSteps([
        { label: "Add a UK phone number", done: phoneOk, href: "/contractor/profile" },
        {
          label: "Company / trading name and registered address (UK)",
          done: ukOk,
          href: "/contractor/profile",
        },
        { label: "At least one service area", done: areas > 0, href: "/contractor/profile" },
        { label: "At least one service with contract text", done: n >= 1, href: "/contractor/services" },
        {
          label: "Bank & Stripe (optional until verified — add before first paid job)",
          done: !!op?.stripe_account_id,
          href: "/contractor/payouts",
        },
      ]);
    })();
  }, [operativeId]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Contractor portal</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage your company profile, service contracts, Stripe payouts, and job invitations from Kleen.
        </p>
      </div>

      {rejectionMessage && (
        <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <ShieldAlert className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">We need more from you before we can approve your application</p>
            <p className="mt-2 whitespace-pre-wrap text-red-800/95">{rejectionMessage}</p>
            <p className="mt-3 text-xs text-red-800/80">
              Update your company profile and services, then Kleen will review again. This message was also emailed to you.
            </p>
          </div>
        </div>
      )}

      {!isVerified && !rejectionMessage && (
        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <ShieldAlert className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">Verification pending</p>
            <p className="mt-0.5 text-amber-800/90">
              Complete the onboarding checklist below: UK company details, service areas, and at least one service
              contract. Bank details can wait until after approval (Payouts). Kleen reviews applications in the admin
              app — jobs and Stripe payouts unlock once you are verified.
            </p>
          </div>
        </div>
      )}

      {!isVerified && onboardingSteps && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Onboarding checklist</p>
          <p className="mt-1 text-xs text-slate-500">
            Complete these so Kleen can verify you. Bank details are optional until you are approved.
          </p>
          <ul className="mt-4 space-y-2.5">
            {onboardingSteps.map((step) => (
              <li key={step.label} className="flex items-start gap-2 text-sm">
                {step.done ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" aria-hidden />
                )}
                <span className={step.done ? "text-slate-500 line-through" : "text-slate-800"}>
                  {step.href ? (
                    <Link href={step.href} className="font-medium text-brand-600 hover:underline">
                      {step.label}
                    </Link>
                  ) : (
                    step.label
                  )}
                </span>
              </li>
            ))}
          </ul>
          {onboardingSteps.every((s) => s.done) && (
            <p className="mt-4 text-xs font-medium text-emerald-800">
              Profile looks complete — Kleen will review your application. Refresh after you make changes.
            </p>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/contractor/profile"
          className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
        >
          <UserRound className="h-8 w-8 text-brand-600" />
          <div>
            <p className="font-semibold text-slate-900">Company &amp; profile</p>
            <p className="mt-1 text-sm text-slate-600">Business details, areas, rates, tax references.</p>
          </div>
        </Link>
        <Link
          href="/contractor/services"
          className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
        >
          <FileText className="h-8 w-8 text-brand-600" />
          <div>
            <p className="font-semibold text-slate-900">Services &amp; contracts</p>
            <p className="mt-1 text-sm text-slate-600">
              {serviceCount === null ? "Loading…" : `${serviceCount} service${serviceCount === 1 ? "" : "s"} linked`} —
              add contract text per service.
            </p>
          </div>
        </Link>
        {isVerified ? (
          <Link
            href="/contractor/payouts"
            className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <Landmark className="h-8 w-8 text-brand-600" />
            <div>
              <p className="font-semibold text-slate-900">Payouts</p>
              <p className="mt-1 text-sm text-slate-600">
                {stripeId ? "Stripe Connect linked — open Stripe to update bank details." : "Connect Stripe for escrow payouts."}
              </p>
            </div>
          </Link>
        ) : (
          <div className="flex items-start gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-5 opacity-90">
            <Landmark className="h-8 w-8 text-slate-400" />
            <div>
              <p className="font-semibold text-slate-600">Payouts</p>
              <p className="mt-1 text-sm text-slate-500">Available after Kleen verifies your contractor account.</p>
            </div>
          </div>
        )}
        {isVerified ? (
          <Link
            href="/contractor/jobs"
            className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <Briefcase className="h-8 w-8 text-brand-600" />
            <div>
              <p className="font-semibold text-slate-900">Jobs &amp; quotes</p>
              <p className="mt-1 text-sm text-slate-600">Invitations to quote and your submitted quotes.</p>
            </div>
          </Link>
        ) : (
          <div className="flex items-start gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-5 opacity-90">
            <Briefcase className="h-8 w-8 text-slate-400" />
            <div>
              <p className="font-semibold text-slate-600">Jobs &amp; quotes</p>
              <p className="mt-1 text-sm text-slate-500">Unlocked when your account is verified.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
