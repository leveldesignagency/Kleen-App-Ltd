"use client";

import { useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { createClient } from "@/lib/supabase/client";
import { usePaymentMethodStore } from "@/lib/payment-methods";
import { Check, X } from "lucide-react";

function AddCardFormInner({
  onSaved,
  onCancel,
}: {
  onSaved: () => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const pmStore = usePaymentMethodStore();
  const supabase = createClient();
  const [postcode, setPostcode] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    const postcodeTrimmed = postcode.trim();
    if (!postcodeTrimmed) {
      setError("Please enter your billing postcode.");
      return;
    }
    const card = elements.getElement(CardElement);
    if (!card) return;
    setSaving(true);
    setError(null);
    try {
      const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
        type: "card",
        card,
        billing_details: { address: { country: "GB", postal_code: postcodeTrimmed } },
      });
      if (pmError || !paymentMethod) {
        setError(pmError?.message ?? "Could not read card.");
        setSaving(false);
        return;
      }
      const last4 = paymentMethod.card?.last4 ?? "";
      const brand = (paymentMethod.card?.brand ?? "card") as string;
      const brandLabel = brand.charAt(0).toUpperCase() + brand.slice(1);
      const isDefault = pmStore.methods.length === 0;
      await pmStore.add(supabase, {
        type: "card",
        label: `${brandLabel} ending in ${last4}`,
        last4,
        brand,
        isDefault,
        stripePaymentMethodId: paymentMethod.id,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save card.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
        <CardElement
          options={{
            style: { base: { fontSize: "16px", color: "#0f172a" }, invalid: { color: "#dc2626" } },
            hidePostalCode: true,
          }}
        />
      </div>
      <div>
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
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={!stripe || saving || !postcode.trim()}
          className="btn-primary gap-2 px-6 disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
          {saving ? "Saving…" : "Add card"}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary gap-2 px-6">
          <X className="h-4 w-4" />
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function AddCardFormStripe({
  onSaved,
  onCancel,
}: {
  onSaved: () => void;
  onCancel: () => void;
}) {
  const stripePublishableKey =
    typeof window !== "undefined" ? process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY : "";
  const stripePromise = useMemo(
    () => (stripePublishableKey ? loadStripe(stripePublishableKey, { locale: "en-GB" }) : null),
    [stripePublishableKey]
  );

  if (!stripePublishableKey || !stripePromise) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <p className="font-medium">Card form not available</p>
        <p className="mt-1 text-xs">
          Stripe is not configured. You can still add cards when paying for a quote.
        </p>
        <button type="button" onClick={onCancel} className="btn-secondary mt-3">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise} options={{ locale: "en-GB" }}>
      <AddCardFormInner onSaved={onSaved} onCancel={onCancel} />
    </Elements>
  );
}
