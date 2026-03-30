"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useContractorPortal } from "@/components/contractor/contractor-portal-context";
import { FileText, Landmark, Briefcase, UserRound, ShieldAlert } from "lucide-react";

export default function ContractorHomePage() {
  const { operativeId, isVerified } = useContractorPortal();
  const [stripeId, setStripeId] = useState<string | null>(null);
  const [serviceCount, setServiceCount] = useState<number | null>(null);

  useEffect(() => {
    if (!operativeId) return;
    const supabase = createClient();
    (async () => {
      const { data: op } = await supabase
        .from("operatives")
        .select("stripe_account_id")
        .eq("id", operativeId)
        .single();
      setStripeId(op?.stripe_account_id || null);

      const { count } = await supabase
        .from("operative_services")
        .select("id", { count: "exact", head: true })
        .eq("operative_id", operativeId);
      setServiceCount(count ?? 0);
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

      {!isVerified && (
        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <ShieldAlert className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">Verification pending</p>
            <p className="mt-0.5 text-amber-800/90">
              Kleen will confirm your business in the admin app (Contractors). Until then, complete your company profile
              and services here. Jobs, quotes, and Stripe payouts unlock after approval — refresh this page once you are
              verified.
            </p>
          </div>
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
