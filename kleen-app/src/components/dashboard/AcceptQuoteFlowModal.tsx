"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { usePaymentMethodStore } from "@/lib/payment-methods";
import { FileText, ShieldCheck, CreditCard, Loader2, CheckCircle2, Check } from "lucide-react";

const KLEEN_TERMS_VERSION = "1.0";

const KLEEN_TERMS = `
Kleen Platform Terms & Conditions

By accepting, you agree that:

1. Kleen acts solely as an intermediary/marketplace connecting you with independent contractors. Kleen is not the service provider.

2. The contract for the cleaning or other service is between you and the contractor. Kleen is not a party to that contract.

3. Kleen is not responsible for: (a) any illegal activity, negligence, or misconduct by the contractor; (b) any civil disputes, damage, loss, or injury arising from or during the service; (c) the quality, timing, or outcome of the work performed by the contractor.

4. You use the platform and engage contractors at your own risk. You must resolve any disputes regarding the service directly with the contractor, subject to any dispute resolution process we make available.

5. Our role is limited to facilitating the connection, processing payments as agreed, and (where applicable) releasing funds to the contractor after completion. We disclaim all liability to the fullest extent permitted by law for anything arising from the contractor's acts or omissions.
`.trim();

export interface CustomerQuoteForAccept {
  quote_request_id: string;
  customer_price_pence: number;
  operative_service_id?: string | null;
}

interface ContractInfo {
  id: string;
  contract_title: string | null;
  contract_content: string | null;
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
  toast: (t: { type: string; title: string; message: string }) => void;
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
  const [step, setStep] = useState<1 | 2 | 3>(1);
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
    if (step !== 3) {
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
          .select("id, contract_title, contract_content, contract_file_url")
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
    if (!contractSigned && (contract || !quote.operative_service_id)) {
      setStep(1);
      return;
    }
    if (!termsAccepted) {
      setStep(2);
      return;
    }
    setStep(3);
  }, [contractLoaded, contractSigned, termsAccepted, contract, quote.operative_service_id]);

  useEffect(() => {
    if (step === 3) {
      syncPaymentMethods(createClient());
    }
  }, [step, syncPaymentMethods]);

  useEffect(() => {
    if (step === 3 && savedCards.length > 0 && !selectedSavedPmId) {
      const defaultCard = savedCards.find((m) => m.isDefault) || savedCards[0];
      setSelectedSavedPmId(defaultCard.id);
      setPayOption("saved");
    } else if (step === 3 && savedCards.length === 0) {
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
  }, [payLoading, toast]);

  const handleSignContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signerName.trim() || !quote.operative_service_id) {
      if (!quote.operative_service_id) {
        setContractSigned(true);
        setStep(2);
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
    setStep(2);
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
    setStep(3);
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
      const { error: confirmError } = await stripe.confirmCardPayment(data.clientSecret);
      if (confirmError) {
        toast({ type: "error", title: "Payment failed", message: confirmError.message || "Card declined." });
        setPayLoading(false);
        return;
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
      const { error: confirmError } = await stripe.confirmCardPayment(data.clientSecret);
      if (confirmError) {
        toast({ type: "error", title: "Payment failed", message: confirmError.message || "Card declined." });
        setPayLoading(false);
        return;
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
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-lg font-semibold text-slate-900">Accept quote — {jobReference}</h2>
          <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
            <span className={step >= 1 ? "text-brand-600" : ""}>
              {contractSigned ? <CheckCircle2 className="inline h-4 w-4" /> : "1"} Contract
            </span>
            <span>→</span>
            <span className={step >= 2 ? "text-brand-600" : ""}>
              {termsAccepted ? <CheckCircle2 className="inline h-4 w-4" /> : "2"} Terms
            </span>
            <span>→</span>
            <span className={step >= 3 ? "text-brand-600" : ""}>3 Pay</span>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-4">
          {step === 1 && (
            <div>
              {!contractLoaded ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
                </div>
              ) : contract ? (
                <>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    {contract.contract_title && (
                      <h3 className="mb-2 font-semibold text-slate-900">{contract.contract_title}</h3>
                    )}
                    <div className="whitespace-pre-wrap">{contract.contract_content || "No content."}</div>
                    {contract.contract_file_url && (
                      <a
                        href={contract.contract_file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-block text-brand-600 hover:underline"
                      >
                        View contract document →
                      </a>
                    )}
                  </div>
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
                      By signing you agree to the contractor&apos;s service contract above.
                    </p>
                    <button
                      type="submit"
                      disabled={signing}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
                    >
                      {signing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                      Sign & continue
                    </button>
                  </form>
                </>
              ) : (
                <div>
                  <p className="text-sm text-slate-600">No contract on file for this quote. You can proceed to platform terms and payment.</p>
                  <button
                    type="button"
                    onClick={() => { setContractSigned(true); setStep(2); }}
                    className="mt-4 w-full rounded-xl bg-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-300"
                  >
                    Continue to terms
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="rounded-xl border border-slate-200 bg-amber-50 p-4 text-sm text-slate-700">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <ShieldCheck className="h-4 w-4 text-amber-600" />
                  Kleen platform terms
                </div>
                <pre className="mt-2 whitespace-pre-wrap font-sans text-xs leading-relaxed">{KLEEN_TERMS}</pre>
              </div>
              <form onSubmit={handleAcceptTerms} className="mt-4">
                <button
                  type="submit"
                  disabled={acceptingTerms}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
                >
                  {acceptingTerms ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  I accept the platform terms & continue
                </button>
              </form>
            </div>
          )}

          {step === 3 && (
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
                      onClick={() => setStep(2)}
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
                    onClick={() => setStep(2)}
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
