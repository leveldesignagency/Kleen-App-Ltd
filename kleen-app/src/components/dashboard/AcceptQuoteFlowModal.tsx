"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { usePaymentMethodStore } from "@/lib/payment-methods";
import type { Notification } from "@/lib/notifications";
import { FileText, ShieldCheck, CreditCard, Loader2, CheckCircle2, Check, Receipt } from "lucide-react";
import { quoteBreakdownPence, CUSTOMER_SERVICE_FEE_RATE } from "@/lib/customer-quote-price";
import { getContractorAddendumPreview } from "@/lib/contract-preview";
import { buildPlatformServiceAgreementText } from "@/lib/platform-service-agreement";

const KLEEN_TERMS_VERSION = "1.1";

/** Canonical text for version 1.1 (stored acceptance); shown in full inside a disclosure on step 3. */
const KLEEN_TERMS_FULL = `
Kleen Platform Terms & Conditions

By accepting, you agree that:

1. Kleen acts solely as an intermediary/marketplace connecting you with independent contractors. Kleen is not the service provider.

2. The contract for the cleaning or other service is between you and the contractor. Kleen is not a party to that contract.

3. Kleen is not responsible for: (a) any illegal activity, negligence, or misconduct by the contractor; (b) any civil disputes, damage, loss, or injury arising from or during the service; (c) the quality, timing, or outcome of the work performed by the contractor.

4. You use the platform and engage contractors at your own risk. You must resolve any disputes regarding the service directly with the contractor, subject to any dispute resolution process we make available.

5. Our role is limited to facilitating the connection, processing payments as agreed, and (where applicable) releasing funds to the contractor after completion. We disclaim all liability to the fullest extent permitted by law for anything arising from the contractor's acts or omissions.

6. Theft, violence, or other criminal matters must be reported to the police. Kleen will cooperate with law enforcement when required by law.
`.trim();

const KLEEN_TERMS_SUMMARY = [
  "Kleen is a marketplace only — your service contract is with the contractor.",
  "Service disputes follow our published process and applicable law between you and the contractor.",
  "Theft, violence, or other crimes: report to the police; Kleen cooperates with law enforcement when the law requires.",
].join(" ");

export interface CustomerQuoteForAccept {
  quote_request_id: string;
  customer_price_pence: number;
  /** Contractor base price (DB `price_pence`) — for breakdown line */
  contractor_price_pence?: number | null;
  estimated_hours?: number;
  available_date?: string | null;
  contractor_label?: string;
  operative_service_id?: string | null;
}

interface ContractInfo {
  id: string;
  contract_title: string | null;
  contract_content: string | null;
  contract_content_preview: string | null;
  contract_file_url: string | null;
}

interface AcceptQuoteFlowModalProps {
  jobId: string;
  jobReference: string;
  quote: CustomerQuoteForAccept;
  onSuccess: () => void;
  onClose: () => void;
  setPayLoading: (v: boolean) => void;
  payLoading?: boolean;
  toast: (t: Omit<Notification, "id">) => void;
}

export function AcceptQuoteFlowModal({
  jobId,
  jobReference,
  quote,
  onSuccess,
  onClose,
  setPayLoading,
  payLoading = false,
  toast,
}: AcceptQuoteFlowModalProps) {
  const stripe = useStripe();
  const elements = useElements();
  const pmMethods = usePaymentMethodStore((s) => s.methods);
  const syncPaymentMethods = usePaymentMethodStore((s) => s.syncFromSupabase);
  const addPaymentMethodIfNew = usePaymentMethodStore((s) => s.addIfNew);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [contract, setContract] = useState<ContractInfo | null>(null);
  const [contractLoaded, setContractLoaded] = useState(false);
  const [contractSigned, setContractSigned] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [signing, setSigning] = useState(false);
  const [acceptingTerms, setAcceptingTerms] = useState(false);
  const [payOption, setPayOption] = useState<"saved" | "new" | "paypal" | "klarna">("saved");
  const [selectedSavedPmId, setSelectedSavedPmId] = useState<string>("");
  const [postcode, setPostcode] = useState("");
  const [stripeTimedOut, setStripeTimedOut] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const savedCards = pmMethods.filter((m) => m.type === "card" && m.stripePaymentMethodId);

  useEffect(() => {
    if (step !== 4) {
      setStripeTimedOut(false);
      return;
    }
    const t = setTimeout(() => setStripeTimedOut(true), 2500);
    return () => clearTimeout(t);
  }, [step]);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (quote.operative_service_id) {
        const { data: os } = await supabase
          .from("operative_services")
          .select("id, contract_title, contract_content, contract_content_preview, contract_file_url")
          .eq("id", quote.operative_service_id)
          .single();
        if (os) setContract(os as ContractInfo);
      }
      setContractLoaded(true);

      const { data: existingSig } = await supabase
        .from("customer_contract_signatures")
        .select("id")
        .eq("job_id", jobId)
        .eq("quote_request_id", quote.quote_request_id)
        .maybeSingle();
      if (existingSig) setContractSigned(true);

      const { data: existingTerms } = await supabase
        .from("kleen_terms_acceptances")
        .select("id")
        .eq("job_id", jobId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (existingTerms) setTermsAccepted(true);
    };
    load();
  }, [jobId, quote.quote_request_id, quote.operative_service_id]);

  useEffect(() => {
    if (!contractLoaded) return;
    if (termsAccepted) {
      setStep(4);
      return;
    }
    if (contractSigned) {
      setStep(3);
      return;
    }
    setStep(1);
  }, [contractLoaded, contractSigned, termsAccepted, contract, quote.operative_service_id]);

  useEffect(() => {
    if (step === 4) {
      syncPaymentMethods(createClient());
    }
  }, [step, syncPaymentMethods]);

  useEffect(() => {
    if (step === 4 && savedCards.length > 0 && !selectedSavedPmId) {
      const defaultCard = savedCards.find((m) => m.isDefault) || savedCards[0];
      setSelectedSavedPmId(defaultCard.id);
      setPayOption("saved");
    } else if (step === 4 && savedCards.length === 0) {
      setPayOption("new");
    }
  }, [step, savedCards, selectedSavedPmId]);

  // If pay loading is stuck for 90s, clear it and show a message
  const payLoadingStartedAt = useRef<number | null>(null);
  useEffect(() => {
    if (payLoading) {
      payLoadingStartedAt.current = Date.now();
    } else {
      payLoadingStartedAt.current = null;
    }
  }, [payLoading]);
  useEffect(() => {
    if (!payLoading) return;
    const t = setTimeout(() => {
      if (payLoadingStartedAt.current && Date.now() - payLoadingStartedAt.current >= 90000) {
        toast({
          type: "error",
          title: "Payment taking too long",
          message: "If you completed 3D Secure, refresh the page to see your job. Otherwise try again or use another card.",
        });
        setPayLoading(false);
      }
    }, 90000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payLoading, toast]);

  const breakdown = useMemo(
    () =>
      quoteBreakdownPence({
        customer_price_pence: quote.customer_price_pence,
        price_pence: quote.contractor_price_pence ?? null,
      }),
    [quote.customer_price_pence, quote.contractor_price_pence],
  );
  const fmt = (pence: number) => `£${(pence / 100).toFixed(2)}`;

  const handleSignContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signerName.trim() || !quote.operative_service_id) {
      if (!quote.operative_service_id) {
        setContractSigned(true);
        setStep(3);
        return;
      }
      toast({ type: "error", title: "Required", message: "Please enter your full name to sign." });
      return;
    }
    setSigning(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ type: "error", title: "Error", message: "You must be signed in." });
      setSigning(false);
      return;
    }
    const { error } = await supabase.from("customer_contract_signatures").insert({
      job_id: jobId,
      quote_request_id: quote.quote_request_id,
      operative_service_id: quote.operative_service_id,
      user_id: user.id,
      signer_name: signerName.trim(),
      signer_email: user.email ?? undefined,
    });
    if (error) {
      toast({ type: "error", title: "Error", message: error.message });
      setSigning(false);
      return;
    }
    setContractSigned(true);
    setStep(3);
    setSigning(false);
  };

  const handleAcceptTerms = async (e: React.FormEvent) => {
    e.preventDefault();
    setAcceptingTerms(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ type: "error", title: "Error", message: "You must be signed in." });
      setAcceptingTerms(false);
      return;
    }
    const { error } = await supabase.from("kleen_terms_acceptances").upsert(
      {
        job_id: jobId,
        user_id: user.id,
        terms_version: KLEEN_TERMS_VERSION,
      },
      { onConflict: "job_id,user_id" }
    );
    if (error) {
      toast({ type: "error", title: "Error", message: error.message });
      setAcceptingTerms(false);
      return;
    }
    setTermsAccepted(true);
    setStep(4);
    setAcceptingTerms(false);
  };

  const createPaymentIntentBody = (overrides: Record<string, unknown> = {}) => ({
    jobId,
    quoteRequestId: quote.quote_request_id,
    customerPricePence: quote.customer_price_pence,
    ...overrides,
  });

  const handlePayWithSavedCard = async () => {
    if (!stripe || !selectedSavedPmId) return;
    setPayLoading(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      const res = await fetch("/api/stripe/create-payment-intent-accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createPaymentIntentBody({ paymentMethodId: selectedSavedPmId })),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.clientSecret) {
        const msg = data?.error || res.statusText || "Could not start payment.";
        toast({ type: "error", title: "Payment failed", message: msg });
        setPayLoading(false);
        return;
      }
      const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(data.clientSecret);
      if (confirmError) {
        toast({ type: "error", title: "Payment failed", message: confirmError.message || "Card declined." });
        setPayLoading(false);
        return;
      }
      if (paymentIntent?.id) {
        await fetch("/api/jobs/confirm-accept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobId,
            quoteRequestId: quote.quote_request_id,
            customerPricePence: quote.customer_price_pence,
            stripePaymentIntentId: paymentIntent.id,
          }),
        });
      }
      setPayLoading(false);
      setPaymentSuccess(true);
      setTimeout(() => onSuccess(), 1600);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Payment failed.";
      toast({
        type: "error",
        title: "Error",
        message: err instanceof Error && err.name === "AbortError" ? "Request timed out. Please try again." : msg,
      });
      setPayLoading(false);
    }
  };

  const handlePayWithNewCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    const postcodeTrimmed = postcode.trim();
    if (!postcodeTrimmed) {
      toast({ type: "error", title: "Postcode required", message: "Please enter your postcode." });
      return;
    }
    const card = elements.getElement(CardElement);
    if (!card) return;
    setPayLoading(true);
    try {
      const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
        type: "card",
        card,
        billing_details: { address: { country: "GB", postal_code: postcodeTrimmed } },
      });
      if (pmError || !paymentMethod) {
        toast({ type: "error", title: "Card error", message: pmError?.message || "Could not read card." });
        setPayLoading(false);
        return;
      }
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      const res = await fetch("/api/stripe/create-payment-intent-accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createPaymentIntentBody({ stripePaymentMethodId: paymentMethod.id })),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.clientSecret) {
        const msg = data?.error || res.statusText || "Could not start payment.";
        toast({ type: "error", title: "Payment failed", message: msg });
        setPayLoading(false);
        return;
      }
      const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(data.clientSecret);
      if (confirmError) {
        toast({ type: "error", title: "Payment failed", message: confirmError.message || "Card declined." });
        setPayLoading(false);
        return;
      }
      if (paymentIntent?.id) {
        await fetch("/api/jobs/confirm-accept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobId,
            quoteRequestId: quote.quote_request_id,
            customerPricePence: quote.customer_price_pence,
            stripePaymentIntentId: paymentIntent.id,
          }),
        });
      }
      // Save this card to Payment Methods so it appears next time (quote flow → payment methods)
      const last4 = paymentMethod.card?.last4 ?? "";
      const brand = (paymentMethod.card?.brand ?? "card") as string;
      const brandLabel = brand.charAt(0).toUpperCase() + brand.slice(1);
      await addPaymentMethodIfNew(createClient(), {
        id: "", // not used by addIfNew
        type: "card",
        label: `${brandLabel} ending in ${last4}`,
        last4,
        brand,
        stripePaymentMethodId: paymentMethod.id,
      });
      setPayLoading(false);
      setPaymentSuccess(true);
      setTimeout(() => onSuccess(), 1600);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Payment failed.";
      toast({
        type: "error",
        title: "Error",
        message: err instanceof Error && err.name === "AbortError" ? "Request timed out. Please try again." : msg,
      });
      setPayLoading(false);
    }
  };

  const handlePayWithRedirect = async (paymentMethodType: "paypal" | "klarna") => {
    if (!stripe || !elements) return;
    setPayLoading(true);
    try {
      const res = await fetch("/api/stripe/create-payment-intent-accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createPaymentIntentBody({ paymentMethodType })),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.clientSecret) {
        toast({ type: "error", title: "Payment failed", message: data.error || "Could not start payment." });
        setPayLoading(false);
        return;
      }
      const returnUrl = typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}?payment=success` : "";
      const { error: confirmError } = await stripe.confirmPayment({
        elements,
        clientSecret: data.clientSecret,
        confirmParams: { return_url: returnUrl },
      });
      if (confirmError) {
        toast({ type: "error", title: "Payment failed", message: confirmError.message || "Payment could not be completed." });
      }
    } catch (err) {
      toast({ type: "error", title: "Error", message: err instanceof Error ? err.message : "Payment failed." });
    } finally {
      setPayLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-lg font-semibold text-slate-900">Accept quote — {jobReference}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-slate-500 sm:text-sm">
            <span className={step >= 1 ? "font-medium text-brand-600" : ""}>
              {step > 1 ? <CheckCircle2 className="mr-0.5 inline h-3.5 w-3.5" /> : null}1 Quote
            </span>
            <span aria-hidden>→</span>
            <span className={step >= 2 ? "font-medium text-brand-600" : ""}>
              {contractSigned ? <CheckCircle2 className="mr-0.5 inline h-3.5 w-3.5" /> : null}2 Service agreement
            </span>
            <span aria-hidden>→</span>
            <span className={step >= 3 ? "font-medium text-brand-600" : ""}>
              {termsAccepted ? <CheckCircle2 className="mr-0.5 inline h-3.5 w-3.5" /> : null}3 Terms
            </span>
            <span aria-hidden>→</span>
            <span className={step >= 4 ? "font-medium text-brand-600" : ""}>4 Pay</span>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-4">
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl border border-brand-100 bg-brand-50/60 p-4">
                <Receipt className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Quote breakdown</h3>
                  <p className="mt-1 text-xs text-slate-600">
                    {quote.contractor_label
                      ? `${quote.contractor_label} — review costs before you sign and pay.`
                      : "Review costs before you sign and pay."}
                  </p>
                </div>
              </div>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-slate-100">
                      <td className="px-4 py-3 text-slate-600">Contractor quote</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">{fmt(breakdown.contractorPence)}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="px-4 py-3 text-slate-600">
                        Kleen platform fee ({Math.round(CUSTOMER_SERVICE_FEE_RATE * 100)}%)
                      </td>
                      <td className="px-4 py-3 text-right text-slate-800">{fmt(breakdown.platformFeePence)}</td>
                    </tr>
                    <tr className="bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-900">Total you pay</td>
                      <td className="px-4 py-3 text-right text-lg font-bold text-slate-900">{fmt(breakdown.totalPence)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {(quote.estimated_hours != null && quote.estimated_hours > 0) || quote.available_date ? (
                <ul className="space-y-1 text-xs text-slate-600">
                  {quote.estimated_hours != null && quote.estimated_hours > 0 && (
                    <li>
                      <span className="font-medium text-slate-700">Est. duration:</span> {quote.estimated_hours}h
                    </li>
                  )}
                  {quote.available_date && (
                    <li>
                      <span className="font-medium text-slate-700">Earliest availability:</span>{" "}
                      {new Date(quote.available_date).toLocaleDateString("en-GB", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </li>
                  )}
                </ul>
              ) : null}
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-500"
              >
                Continue
              </button>
            </div>
          )}

          {step === 2 && (
            <div>
              {!contractLoaded ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
                </div>
              ) : contract ? (
                <>
                  <p className="text-xs text-slate-600">
                    You&apos;re agreeing to the standard Kleen service understanding below (and any short contractor
                    addendum). Any <strong>long-form</strong> or PDF terms the contractor keeps on file are emailed to
                    you after your payment is authorised and held in escrow — we don&apos;t show that full text here.
                  </p>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    <div className="whitespace-pre-wrap">
                      {buildPlatformServiceAgreementText({
                        jobReference,
                        totalFormatted: fmt(breakdown.totalPence),
                        contractorLabel: quote.contractor_label,
                      })}
                    </div>
                  </div>
                  {getContractorAddendumPreview(contract.contract_content_preview) ? (
                    <div className="mt-3 rounded-xl border border-brand-100 bg-brand-50/50 p-4 text-sm text-slate-700">
                      <h3 className="mb-2 font-semibold text-slate-900">
                        {contract.contract_title?.trim() || "Contractor addendum"}
                      </h3>
                      <div className="whitespace-pre-wrap">
                        {getContractorAddendumPreview(contract.contract_content_preview)}
                      </div>
                    </div>
                  ) : null}
                  {contract.contract_file_url ? (
                    <p className="mt-3 text-xs text-slate-600">
                      A PDF copy of the contractor&apos;s full terms (if provided) is linked in your confirmation email
                      after payment — not shown here before escrow.
                    </p>
                  ) : null}
                  <form onSubmit={handleSignContract} className="mt-4 space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-500">Your full name (e-signature)</label>
                      <input
                        type="text"
                        value={signerName}
                        onChange={(e) => setSignerName(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        placeholder="Type your full name"
                        required
                      />
                    </div>
                    <p className="text-xs text-slate-500">
                      By signing you agree to the service agreement (and addendum, if any) shown above. Long-form terms
                      may follow by email after payment is secured.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        disabled={signing}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
                      >
                        {signing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                        Sign & continue
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <div>
                  <p className="text-sm text-slate-600">
                    No contractor service record is linked to this quote. Continue to Kleen platform terms and payment —
                    the standard service agreement still applies where we connect you with a contractor.
                  </p>
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => { setContractSigned(true); setStep(3); }}
                      className="flex-1 rounded-xl bg-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-300"
                    >
                      Continue to terms
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="rounded-xl border border-slate-200 bg-amber-50 p-4 text-sm text-slate-700">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <ShieldCheck className="h-4 w-4 text-amber-600" />
                  Kleen platform terms
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-700">{KLEEN_TERMS_SUMMARY}</p>
                <p className="mt-2 text-xs text-slate-500">
                  By continuing you accept the full Kleen platform terms (version {KLEEN_TERMS_VERSION}) below.
                </p>
                <details className="mt-3 rounded-lg border border-amber-200/80 bg-white/60 px-3 py-2">
                  <summary className="cursor-pointer text-xs font-medium text-slate-800">
                    Read full platform terms (version {KLEEN_TERMS_VERSION})
                  </summary>
                  <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-slate-700">
                    {KLEEN_TERMS_FULL}
                  </pre>
                </details>
              </div>
              <form onSubmit={handleAcceptTerms} className="mt-4 space-y-3">
                <button
                  type="submit"
                  disabled={acceptingTerms}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
                >
                  {acceptingTerms ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  I accept the platform terms & continue
                </button>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="w-full rounded-xl border border-slate-300 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Back
                </button>
              </form>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              {paymentSuccess ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <CheckCircle2 className="h-16 w-16 text-green-500" />
                  <p className="mt-4 text-xl font-semibold text-slate-900">Payment successful!</p>
                  <p className="mt-1 text-sm text-slate-500">Your job is confirmed. Closing…</p>
                </div>
              ) : (
                <>
                  {/* Amount */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-5 py-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Amount to pay</p>
                    <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                      £{(quote.customer_price_pence / 100).toFixed(2)}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800">Payment method</p>
                    <Link
                      href="/dashboard/payment-methods"
                      className="text-sm text-brand-600 hover:text-brand-700 hover:underline"
                    >
                      Manage cards
                    </Link>
                  </div>

              {stripe && elements ? (
                <>
                  <div className="space-y-2">
                      {savedCards.length > 0 ? (
                        <>
                          <p className="text-xs font-medium text-slate-500">Your saved cards</p>
                          {savedCards.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => { setPayOption("saved"); setSelectedSavedPmId(m.id); }}
                              className={`flex w-full items-center justify-between rounded-xl border-2 px-4 py-3 text-left text-sm transition-colors ${
                                payOption === "saved" && selectedSavedPmId === m.id
                                  ? "border-brand-500 bg-brand-50/80 text-brand-800"
                                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                              }`}
                            >
                              <span className="font-medium">{m.label}</span>
                              {payOption === "saved" && selectedSavedPmId === m.id && <Check className="h-5 w-5 text-brand-600" />}
                            </button>
                          ))}
                          <p className="py-1 text-center text-xs text-slate-400">or</p>
                        </>
                      ) : (
                        <p className="text-xs text-slate-500">
                          No saved cards. Add one in{" "}
                          <Link href="/dashboard/payment-methods" className="text-brand-600 hover:underline">
                            Payment Methods
                          </Link>{" "}
                          for faster checkout next time.
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => setPayOption("new")}
                        className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-sm transition-colors ${
                          payOption === "new" ? "border-brand-500 bg-brand-50/80 text-brand-800" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                        }`}
                      >
                        <CreditCard className="h-5 w-5 text-slate-500" />
                        <span className="font-medium">New card</span>
                        {payOption === "new" && <Check className="ml-auto h-5 w-5 text-brand-600" />}
                      </button>
                    </div>

                  {payOption === "new" && (
                    <div className="rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-sm">
                      <p className="mb-3 text-sm font-semibold text-slate-800">Card details</p>
                      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                        <CardElement
                          options={{
                            style: { base: { fontSize: "16px", color: "#0f172a" }, invalid: { color: "#dc2626" } },
                            hidePostalCode: true,
                          }}
                        />
                      </div>
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-slate-700">Billing postcode</label>
                        <input
                          type="text"
                          value={postcode}
                          onChange={(e) => setPostcode(e.target.value.toUpperCase())}
                          placeholder="e.g. SW1A 1AA"
                          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                          maxLength={10}
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="mb-2 text-sm font-semibold text-slate-800">Other options</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setPayOption("paypal")}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-colors ${
                          payOption === "paypal" ? "border-[#003087] bg-[#003087]/10 text-[#003087]" : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        PayPal
                        {payOption === "paypal" && <Check className="h-4 w-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPayOption("klarna")}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-colors ${
                          payOption === "klarna" ? "border-[#FFB3C7] bg-[#FFB3C7]/20 text-[#0A0B09]" : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        Klarna
                        {payOption === "klarna" && <Check className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-3 border-t border-slate-200 pt-4">
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Back
                    </button>
                    {payOption === "saved" && selectedSavedPmId ? (
                      <button
                        type="button"
                        onClick={handlePayWithSavedCard}
                        disabled={payLoading}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
                      >
                        {payLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Pay £{(quote.customer_price_pence / 100).toFixed(2)}
                      </button>
                    ) : payOption === "new" ? (
                      <form onSubmit={handlePayWithNewCard} className="flex flex-1">
                        <button
                          type="submit"
                          disabled={payLoading || !postcode.trim()}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
                        >
                          {payLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                          Pay £{(quote.customer_price_pence / 100).toFixed(2)}
                        </button>
                      </form>
                    ) : payOption === "paypal" ? (
                      <button
                        type="button"
                        onClick={() => handlePayWithRedirect("paypal")}
                        disabled={payLoading}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#003087] py-2.5 text-sm font-semibold text-white hover:bg-[#003087]/90 disabled:opacity-50"
                      >
                        {payLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue to PayPal"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handlePayWithRedirect("klarna")}
                        disabled={payLoading}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#FFB3C7] py-2.5 text-sm font-semibold text-[#0A0B09] hover:bg-[#FFB3C7]/90 disabled:opacity-50"
                      >
                        {payLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue to Klarna"}
                      </button>
                    )}
                  </div>
                </>
              ) : !stripeTimedOut ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
                  <p className="mt-3 text-sm text-slate-600">Loading payment options…</p>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  <p className="font-medium">Payment is not available right now.</p>
                  <p className="mt-2 text-xs">
                    Add <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> to{" "}
                    <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">kleen-app/.env.local</code> and restart the dev server.
                  </p>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="mt-3 rounded-xl border border-slate-300 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Back
                  </button>
                </div>
              )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 px-4 py-2">
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
