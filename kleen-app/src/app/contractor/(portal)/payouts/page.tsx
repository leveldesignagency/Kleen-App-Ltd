"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useContractorPortal } from "@/components/contractor/contractor-portal-context";
import { Loader2, ExternalLink } from "lucide-react";

export default function ContractorPayoutsPage() {
  const router = useRouter();
  const { operativeId, refresh, isVerified } = useContractorPortal();
  const [stripeBanner, setStripeBanner] = useState<"return" | "refresh" | null>(null);
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (!isVerified) {
      router.replace("/contractor");
    }
  }, [isVerified, router]);

  useEffect(() => {
    if (!operativeId || !isVerified) return;
    const supabase = createClient();
    (async () => {
      const { data: op } = await supabase
        .from("operatives")
        .select("stripe_account_id")
        .eq("id", operativeId)
        .single();
      setStripeAccountId(op?.stripe_account_id || null);
      setLoading(false);
    })();
  }, [operativeId, isVerified]);

  useEffect(() => {
    if (typeof window === "undefined" || !isVerified) return;
    const q = new URLSearchParams(window.location.search);
    if (q.get("stripe_return")) setStripeBanner("return");
    else if (q.get("stripe_refresh")) setStripeBanner("refresh");
    if (q.get("stripe_return") || q.get("stripe_refresh")) refresh();
  }, [refresh, isVerified]);

  useEffect(() => {
    if (!operativeId || !stripeBanner || !isVerified) return;
    const supabase = createClient();
    supabase
      .from("operatives")
      .select("stripe_account_id")
      .eq("id", operativeId)
      .single()
      .then(({ data }) => {
        if (data?.stripe_account_id) setStripeAccountId(data.stripe_account_id);
      });
  }, [operativeId, stripeBanner, isVerified]);

  const startOnboarding = async () => {
    setRedirecting(true);
    try {
      const res = await fetch("/api/stripe/connect-account-link", { method: "POST", credentials: "include" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Could not start Stripe");
        setRedirecting(false);
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
    }
    setRedirecting(false);
  };

  if (!isVerified) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Payouts (Stripe)</h1>
        <p className="mt-1 text-sm text-slate-600">
          Kleen pays you through Stripe Connect after jobs complete. You enter bank details on Stripe&apos;s secure
          flow — we do not store your bank numbers in the contractor portal.
        </p>
      </div>

      {stripeBanner === "return" && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Stripe onboarding step finished. If anything is still required, Stripe will prompt you when you open the link
          again.
        </div>
      )}
      {stripeBanner === "refresh" && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
          Link refreshed — continue setup with Stripe below.
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {stripeAccountId ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-700">
              <span className="font-medium text-slate-900">Connected account:</span>{" "}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{stripeAccountId}</code>
            </p>
            <p className="text-sm text-slate-600">
              To update bank details or complete verification, continue Stripe onboarding (same secure link).
            </p>
            <button
              type="button"
              disabled={redirecting}
              onClick={startOnboarding}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
            >
              {redirecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
              Open Stripe setup
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-700">You have not connected Stripe yet. You will need this to receive payouts.</p>
            <button
              type="button"
              disabled={redirecting}
              onClick={startOnboarding}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
            >
              {redirecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
              Connect with Stripe
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
