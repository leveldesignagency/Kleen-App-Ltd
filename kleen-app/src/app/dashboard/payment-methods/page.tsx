"use client";

import { useState, useEffect } from "react";
import {
  CreditCard,
  Plus,
  Trash2,
  Star,
  Check,
  X,
  ExternalLink,
  Landmark,
  FileText,
  Building2,
  Loader2,
  Unlink,
} from "lucide-react";
import { PaymentMethod } from "@/types";
import { useUserProfile } from "@/lib/user-profile";
import { usePaymentMethodStore } from "@/lib/payment-methods";
import CardBrandLogo from "@/components/ui/CardBrandLogo";

interface ConnectedService {
  id: string;
  provider: string;
  label: string;
  email?: string;
  connected: boolean;
}


const INITIAL_PERSONAL_SERVICES: ConnectedService[] = [
  { id: "svc-paypal", provider: "paypal", label: "PayPal", email: undefined, connected: false },
  { id: "svc-klarna", provider: "klarna", label: "Klarna", email: undefined, connected: false },
];

const INITIAL_BUSINESS_SERVICES: ConnectedService[] = [
  { id: "svc-bacs", provider: "bacs", label: "BACS Bank Transfer", connected: false },
  { id: "svc-dd", provider: "direct_debit", label: "Direct Debit (GoCardless)", connected: false },
  { id: "svc-invoice", provider: "invoice", label: "Invoice (Net 30)", connected: false },
];

const PROVIDER_META: Record<string, { icon?: React.ElementType; brand?: string; color: string; desc: string }> = {
  paypal:      { brand: "paypal",  color: "bg-blue-50 text-blue-600 border-blue-200",    desc: "Pay with your PayPal balance or linked bank account" },
  klarna:      { brand: "klarna",  color: "bg-pink-50 text-pink-600 border-pink-200",    desc: "Pay later in 3 interest-free instalments" },
  bacs:        { icon: Landmark,   color: "bg-emerald-50 text-emerald-600 border-emerald-200", desc: "Direct bank-to-bank transfer — usually 1-2 working days" },
  direct_debit:{ icon: Building2,  color: "bg-teal-50 text-teal-600 border-teal-200",    desc: "Automatic collection via GoCardless Direct Debit" },
  invoice:     { icon: FileText,   color: "bg-amber-50 text-amber-600 border-amber-200", desc: "Receive a VAT invoice and pay within 30 days" },
};

export default function PaymentMethodsPage() {
  const { accountType } = useUserProfile();
  const pmStore = usePaymentMethodStore();
  const methods = pmStore.methods;
  const [services, setServices] = useState<ConnectedService[]>(INITIAL_PERSONAL_SERVICES);

  useEffect(() => {
    setServices(accountType === "business" ? INITIAL_BUSINESS_SERVICES : INITIAL_PERSONAL_SERVICES);
  }, [accountType]);
  const [adding, setAdding] = useState(false);
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [cardName, setCardName] = useState("");
  const [saving, setSaving] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(.{4})/g, "$1 ").trim();
  };

  const formatExpiry = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    if (digits.length >= 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return digits;
  };

  const handleAddCard = async () => {
    if (!cardNumber || !cardExpiry || !cardCvc || !cardName) return;
    setSaving(true);
    await new Promise((r) => setTimeout(r, 600));
    const last4 = cardNumber.replace(/\s/g, "").slice(-4);
    const brand = cardNumber.startsWith("4") ? "visa" : cardNumber.startsWith("5") ? "mastercard" : "amex";
    const BRAND_LABELS: Record<string, string> = { visa: "Visa", mastercard: "Mastercard", amex: "Amex" };
    const newMethod: PaymentMethod = {
      id: `pm_${Date.now()}`,
      type: "card",
      label: `${BRAND_LABELS[brand] || "Card"} ending in ${last4}`,
      last4,
      brand,
      isDefault: methods.length === 0,
    };
    pmStore.add(newMethod);
    setAdding(false);
    setCardNumber("");
    setCardExpiry("");
    setCardCvc("");
    setCardName("");
    setSaving(false);
  };

  const remove = (id: string) => pmStore.remove(id);
  const setDefault = (id: string) => pmStore.setDefault(id);

  const handleConnect = async (svcId: string) => {
    setConnectingId(svcId);
    await new Promise((r) => setTimeout(r, 1200));
    setServices((prev) =>
      prev.map((s) =>
        s.id === svcId
          ? { ...s, connected: true, email: s.provider === "paypal" ? "user@example.com" : undefined }
          : s
      )
    );
    setConnectingId(null);
  };

  const handleDisconnect = (svcId: string) => {
    setServices((prev) =>
      prev.map((s) => (s.id === svcId ? { ...s, connected: false, email: undefined } : s))
    );
  };


  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payment Methods</h1>
          <p className="mt-1 text-sm text-slate-500">Manage your saved cards and payment options</p>
        </div>
        {!adding && (
          <button onClick={() => setAdding(true)} className="btn-primary gap-2">
            <Plus className="h-4 w-4" />
            Add Card
          </button>
        )}
      </div>

      {/* Add card form */}
      {adding && (
        <div className="mt-6 rounded-2xl border border-brand-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Add New Card</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700">Name on card</label>
              <input type="text" value={cardName} onChange={(e) => setCardName(e.target.value)} className="input-field mt-1" placeholder="J. Smith" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700">Card number</label>
              <input type="text" value={cardNumber} onChange={(e) => setCardNumber(formatCardNumber(e.target.value))} className="input-field mt-1" placeholder="4242 4242 4242 4242" maxLength={19} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Expiry</label>
              <input type="text" value={cardExpiry} onChange={(e) => setCardExpiry(formatExpiry(e.target.value))} className="input-field mt-1" placeholder="MM/YY" maxLength={5} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">CVC</label>
              <input type="text" value={cardCvc} onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, "").slice(0, 4))} className="input-field mt-1" placeholder="123" maxLength={4} />
            </div>
          </div>
          <div className="mt-5 flex gap-3">
            <button
              onClick={handleAddCard}
              disabled={!cardNumber || !cardExpiry || !cardCvc || !cardName || saving}
              className="btn-primary gap-2 px-6 disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              {saving ? "Adding…" : "Add Card"}
            </button>
            <button onClick={() => setAdding(false)} className="btn-secondary gap-2 px-6">
              <X className="h-4 w-4" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Saved cards */}
      <h2 className="mb-3 mt-8 text-sm font-semibold text-slate-900">Cards</h2>
      <div className="space-y-3">
        {methods.map((method) => (
          <div
            key={method.id}
            className={`flex items-center justify-between rounded-2xl border bg-white p-5 transition-all ${
              method.isDefault ? "border-brand-200 ring-1 ring-brand-100" : "border-slate-200"
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50">
                <CardBrandLogo brand={method.brand} className="h-7 w-auto rounded" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {method.label}
                  {method.isDefault && (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-600">
                      <Star className="h-2.5 w-2.5 fill-brand-500" />
                      Default
                    </span>
                  )}
                </p>
                <p className="text-xs capitalize text-slate-400">{method.type}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {!method.isDefault && (
                <button
                  onClick={() => setDefault(method.id)}
                  className="rounded-lg border border-slate-200 p-2 text-slate-400 transition-colors hover:border-brand-200 hover:text-brand-600"
                  title="Set as default"
                >
                  <Star className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => remove(method.id)}
                className="rounded-lg border border-slate-200 p-2 text-slate-400 transition-colors hover:border-red-200 hover:text-red-500"
                title="Remove"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        {methods.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 py-8 text-center">
            <CreditCard className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-sm text-slate-400">No cards saved yet</p>
            <p className="text-xs text-slate-300">Cards from your bookings will appear here automatically</p>
          </div>
        )}
      </div>

      {/* Connected payment services */}
      <h2 className="mb-1 mt-10 text-sm font-semibold text-slate-900">
        {accountType === "business" ? "Business Payment Options" : "Other Payment Options"}
      </h2>
      <p className="mb-4 text-xs text-slate-400">
        {accountType === "business"
          ? "Connect business payment methods for invoicing and automated collection"
          : "Connect additional ways to pay at checkout"}
      </p>

      <div className="space-y-3">
        {services.map((svc) => {
          const meta = PROVIDER_META[svc.provider];
          if (!meta) return null;
          const Icon = meta.icon;
          const isConnecting = connectingId === svc.id;

          return (
            <div
              key={svc.id}
              className={`flex items-center justify-between rounded-2xl border bg-white p-5 transition-all ${
                svc.connected ? `${meta.color} border-2` : "border-slate-200"
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  svc.connected ? meta.color : "bg-slate-50"
                }`}>
                  {meta.brand ? (
                    <CardBrandLogo brand={meta.brand} className="h-7 w-auto rounded" />
                  ) : Icon ? (
                    <Icon className="h-5 w-5" />
                  ) : null}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {svc.label}
                    {svc.connected && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
                        <Check className="h-2.5 w-2.5" />
                        Connected
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {svc.connected && svc.email ? svc.email : meta.desc}
                  </p>
                </div>
              </div>

              <div>
                {svc.connected ? (
                  <button
                    onClick={() => handleDisconnect(svc.id)}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 transition-colors hover:border-red-200 hover:text-red-500"
                  >
                    <Unlink className="h-3.5 w-3.5" />
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={() => handleConnect(svc.id)}
                    disabled={isConnecting}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:border-brand-300 hover:text-brand-600 disabled:opacity-50"
                  >
                    {isConnecting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ExternalLink className="h-3.5 w-3.5" />
                    )}
                    {isConnecting ? "Connecting…" : "Connect"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {accountType === "business" && (
        <div className="mt-6 rounded-xl bg-amber-50 p-4">
          <p className="text-xs font-medium text-amber-700">
            Invoice and Direct Debit options are subject to credit approval. BACS transfers may take 1-2 working days to clear.
          </p>
        </div>
      )}
    </div>
  );
}
