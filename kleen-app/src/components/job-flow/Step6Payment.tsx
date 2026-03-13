"use client";

import { useState, useEffect } from "react";
import { useJobFlowStore } from "@/lib/store";
import { PaymentMethod } from "@/types";
import { usePaymentMethodStore } from "@/lib/payment-methods";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Check,
  X,
} from "lucide-react";
import CardBrandLogo from "@/components/ui/CardBrandLogo";

const BRAND_ICONS: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "Amex",
};

function PayPalIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 2.23A.774.774 0 0 1 5.708 1.6h6.346c2.1 0 3.605.462 4.474 1.374.406.427.678.912.83 1.486.159.6.158 1.314-.003 2.12l-.014.075v.66l.516.296c.436.222.782.477 1.04.77.36.408.588.913.678 1.504.093.607.046 1.313-.136 2.1-.211.907-.556 1.697-1.025 2.347a4.727 4.727 0 0 1-1.58 1.47c-.6.354-1.293.61-2.06.76-.746.146-1.574.22-2.463.22h-.585a1.77 1.77 0 0 0-1.748 1.496l-.044.234-.738 4.677-.034.17a.23.23 0 0 1-.226.193H7.076z" />
    </svg>
  );
}

function KlarnaIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M4.592 2H1v20h3.592V2zm11.46 0c0 4.194-1.583 8.09-4.378 11.075L16.96 22h-4.148l-5.3-9.397a15.477 15.477 0 0 0 3.752-5.053A14.927 14.927 0 0 0 12.754 2h3.298zM21 17.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z" />
    </svg>
  );
}

export default function Step6Payment() {
  const {
    savedPaymentMethods,
    paymentMethodId,
    setPaymentMethodId,
    setSavedPaymentMethods,
    addPaymentMethod,
    setStep,
  } = useJobFlowStore();

  const sharedMethods = usePaymentMethodStore((s) => s.methods);
  const syncFromSupabase = usePaymentMethodStore((s) => s.syncFromSupabase);

  useEffect(() => {
    syncFromSupabase(createClient());
  }, [syncFromSupabase]);

  // Always show the customer's saved cards from Supabase (dashboard). Prefer this over
  // persisted job-flow state so cards they added in Account/Payment Methods always appear.
  useEffect(() => {
    if (sharedMethods.length > 0) {
      setSavedPaymentMethods(sharedMethods);
      const defaultCard = sharedMethods.find((m) => m.isDefault);
      if (defaultCard) setPaymentMethodId(defaultCard.id);
      else if (sharedMethods.length > 0) setPaymentMethodId(sharedMethods[0].id);
    }
  }, [sharedMethods, setSavedPaymentMethods, setPaymentMethodId]);

  const [showAddCard, setShowAddCard] = useState(false);
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [cardName, setCardName] = useState("");
  const [addingCard, setAddingCard] = useState(false);

  const selectedMethod = paymentMethodId;

  const handleSelectMethod = (id: string) => setPaymentMethodId(id);

  const handleAddCard = async () => {
    if (!cardNumber || !cardExpiry || !cardCvc || !cardName) return;
    setAddingCard(true);
    await new Promise((r) => setTimeout(r, 800));
    const last4 = cardNumber.replace(/\s/g, "").slice(-4);
    const brand = cardNumber.startsWith("4") ? "visa" : cardNumber.startsWith("5") ? "mastercard" : "amex";
    const newMethod: PaymentMethod = {
      id: `card_${Date.now()}`,
      type: "card",
      label: `${BRAND_ICONS[brand] || "Card"} ending in ${last4}`,
      last4,
      brand,
    };
    addPaymentMethod(newMethod);
    setShowAddCard(false);
    setCardNumber("");
    setCardExpiry("");
    setCardCvc("");
    setCardName("");
    setAddingCard(false);
  };

  const handleSelectPayPal = () => {
    const existing = savedPaymentMethods.find((m) => m.type === "paypal");
    if (existing) { setPaymentMethodId(existing.id); return; }
    addPaymentMethod({ id: `paypal_${Date.now()}`, type: "paypal", label: "PayPal" });
  };

  const handleSelectKlarna = () => {
    const existing = savedPaymentMethods.find((m) => m.type === "klarna");
    if (existing) { setPaymentMethodId(existing.id); return; }
    addPaymentMethod({ id: `klarna_${Date.now()}`, type: "klarna", label: "Klarna — Pay later or in 3 instalments" });
  };

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(.{4})/g, "$1 ").trim();
  };

  const formatExpiry = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    if (digits.length >= 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return digits;
  };

  const canContinue = !!selectedMethod;

  return (
    <div>
      <button
        onClick={() => setStep(5)}
        className="mb-4 flex items-center gap-1 text-sm text-slate-400 transition-colors hover:text-slate-600"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back
      </button>

      <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Payment Method</h1>
      <p className="mt-1 text-sm text-slate-500">
        Choose how you&apos;d like to pay. You won&apos;t be charged until the job is complete.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left column — card payments */}
        <div className="space-y-4">
          {savedPaymentMethods.filter((m) => m.type === "card").length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-700">Saved Cards</h3>
              {savedPaymentMethods.filter((m) => m.type === "card").map((method) => (
                <button
                  key={method.id}
                  onClick={() => handleSelectMethod(method.id)}
                  className={`flex w-full items-center gap-3 rounded-xl border-2 p-4 text-left transition-all ${
                    selectedMethod === method.id ? "border-brand-500 bg-brand-50" : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-50">
                    <CardBrandLogo brand={method.brand} className="h-7 w-auto rounded" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">{method.label}</p>
                    {method.isDefault && <span className="text-xs text-brand-600">Default</span>}
                  </div>
                  {selectedMethod === method.id && <Check className="h-5 w-5 text-brand-500" />}
                </button>
              ))}
            </div>
          )}

          {!showAddCard ? (
            <button
              onClick={() => setShowAddCard(true)}
              className="flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-slate-300 p-4 text-left transition-all hover:border-brand-400 hover:bg-brand-50/50"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Add a new card</p>
                <p className="text-xs text-slate-400">Visa, Mastercard, or Amex</p>
              </div>
            </button>
          ) : (
            <div className="rounded-xl border-2 border-brand-200 bg-white p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">New Card</h3>
                <button onClick={() => setShowAddCard(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600">Name on card</label>
                  <input type="text" value={cardName} onChange={(e) => setCardName(e.target.value)} className="input-field mt-1" placeholder="J. Smith" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600">Card number</label>
                  <input type="text" value={cardNumber} onChange={(e) => setCardNumber(formatCardNumber(e.target.value))} className="input-field mt-1" placeholder="4242 4242 4242 4242" maxLength={19} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600">Expiry</label>
                    <input type="text" value={cardExpiry} onChange={(e) => setCardExpiry(formatExpiry(e.target.value))} className="input-field mt-1" placeholder="MM/YY" maxLength={5} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600">CVC</label>
                    <input type="text" value={cardCvc} onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, "").slice(0, 4))} className="input-field mt-1" placeholder="123" maxLength={4} />
                  </div>
                </div>
                <button onClick={handleAddCard} disabled={!cardNumber || !cardExpiry || !cardCvc || !cardName || addingCard} className="btn-primary w-full py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50">
                  {addingCard ? "Adding…" : "Add Card"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right column — alternative methods */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-700">Other Payment Options</h3>

          <button
            onClick={handleSelectPayPal}
            className={`flex w-full items-center gap-3 rounded-xl border-2 p-4 text-left transition-all ${
              savedPaymentMethods.find((m) => m.type === "paypal" && m.id === selectedMethod) ? "border-brand-500 bg-brand-50" : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${savedPaymentMethods.find((m) => m.type === "paypal" && m.id === selectedMethod) ? "bg-[#003087] text-white" : "bg-[#003087]/10 text-[#003087]"}`}>
              <PayPalIcon className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-900">PayPal</p>
              <p className="text-xs text-slate-400">Pay with your PayPal account</p>
            </div>
            {savedPaymentMethods.find((m) => m.type === "paypal" && m.id === selectedMethod) && <Check className="h-5 w-5 text-brand-500" />}
          </button>

          <button
            onClick={handleSelectKlarna}
            className={`flex w-full items-center gap-3 rounded-xl border-2 p-4 text-left transition-all ${
              savedPaymentMethods.find((m) => m.type === "klarna" && m.id === selectedMethod) ? "border-brand-500 bg-brand-50" : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${savedPaymentMethods.find((m) => m.type === "klarna" && m.id === selectedMethod) ? "bg-[#FFB3C7] text-[#0A0B09]" : "bg-[#FFB3C7]/20 text-[#0A0B09]"}`}>
              <KlarnaIcon className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-900">Klarna</p>
              <p className="text-xs text-slate-400">Pay later or split into 3 interest-free payments</p>
            </div>
            {savedPaymentMethods.find((m) => m.type === "klarna" && m.id === selectedMethod) && <Check className="h-5 w-5 text-brand-500" />}
          </button>

          <p className="text-xs text-slate-400">
            Your card will not be charged until the job is completed and approved.
          </p>
        </div>
      </div>

      <button
        onClick={() => setStep(7)}
        disabled={!canContinue}
        className="btn-primary mt-6 w-full gap-2 py-3.5 disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto lg:px-12"
      >
        Continue to Review
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}
