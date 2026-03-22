"use client";

import { CardElement, useStripe, useElements } from "@stripe/react-stripe-js";

export interface CustomerQuoteForPay {
  quote_request_id: string;
  customer_price_pence: number;
}

export function PayModalForm({
  quote,
  jobId,
  onSuccess,
  onClose,
  setPayLoading,
  toast,
}: {
  quote: CustomerQuoteForPay;
  jobId: string;
  onSuccess: () => void;
  onClose: () => void;
  setPayLoading: (v: boolean) => void;
  toast: (t: { type: string; title: string; message: string }) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    const card = elements.getElement(CardElement);
    if (!card) return;
    setPayLoading(true);
    try {
      const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({ type: "card", card });
      if (pmError || !paymentMethod) {
        toast({ type: "error", title: "Card error", message: pmError?.message || "Could not read card." });
        setPayLoading(false);
        return;
      }
      const res = await fetch("/api/stripe/create-payment-intent-accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          quoteRequestId: quote.quote_request_id,
          customerPricePence: quote.customer_price_pence,
          stripePaymentMethodId: paymentMethod.id,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.clientSecret) {
        toast({ type: "error", title: "Payment failed", message: data.error || "Could not start payment." });
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
      onSuccess();
    } catch (err) {
      toast({ type: "error", title: "Error", message: err instanceof Error ? err.message : "Payment failed." });
    } finally {
      setPayLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <CardElement
          options={{
            style: { base: { fontSize: "16px", color: "#0f172a" }, invalid: { color: "#dc2626" } },
          }}
        />
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-xl border border-slate-300 bg-white py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex-1 rounded-xl bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
        >
          Pay now
        </button>
      </div>
    </form>
  );
}
