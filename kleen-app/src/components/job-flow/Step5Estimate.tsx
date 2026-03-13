"use client";

import { useState, useEffect } from "react";
import { useJobFlowStore } from "@/lib/store";
import { getService, getCategory } from "@/lib/services";
import PriceEstimateCard from "@/components/ui/PriceEstimateCard";
import { ArrowLeft, ArrowRight, MapPin, Calendar, Clock, AlertCircle, Home, Building2, User } from "lucide-react";
import { useAddressStore, type SavedAddress } from "@/lib/addresses";
import { createClient } from "@/lib/supabase/client";
import CustomDropdown from "@/components/ui/CustomDropdown";
import Link from "next/link";

const UK_POSTCODE_RE =
  /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

interface FieldErrors {
  address?: string;
  postcode?: string;
  preferredDate?: string;
  preferredTime?: string;
}

function validate(
  address: string,
  postcode: string,
  preferredDate: string,
  preferredTime: string
): FieldErrors {
  const errors: FieldErrors = {};

  if (!address.trim()) {
    errors.address = "Address is required";
  }

  if (!postcode.trim()) {
    errors.postcode = "Postcode is required";
  } else if (!UK_POSTCODE_RE.test(postcode.trim())) {
    errors.postcode = "Enter a valid UK postcode";
  }

  if (!preferredDate) {
    errors.preferredDate = "Please select a date";
  } else {
    const selected = new Date(preferredDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selected < today) {
      errors.preferredDate = "Date must be today or later";
    }
  }

  if (!preferredTime) {
    errors.preferredTime = "Please select a time";
  }

  return errors;
}

export default function Step5Estimate() {
  const {
    serviceId,
    categoryId,
    cleaningType,
    details,
    estimate,
    address,
    postcode,
    preferredDate,
    preferredTime,
    setAddress,
    setPostcode,
    setPreferredDate,
    setPreferredTime,
    setStep,
  } = useJobFlowStore();

  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [bookingAs, setBookingAs] = useState<"personal" | "business">("personal");
  const [businessName, setBusinessName] = useState<string>("");
  const savedAddresses = useAddressStore((s) => s.addresses);
  const syncFromSupabase = useAddressStore((s) => s.syncFromSupabase);

  useEffect(() => {
    syncFromSupabase(createClient());
  }, [syncFromSupabase]);

  // Load profile account type and business name
  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("account_type").eq("id", user.id).single();
      if (profile?.account_type === "business") setBookingAs("business");
      const { data: biz } = await supabase.from("business_profiles").select("company_name").eq("user_id", user.id).maybeSingle();
      if (biz?.company_name) setBusinessName(biz.company_name);
    };
    load();
  }, []);

  const handleSelectAddress = (addr: SavedAddress | null) => {
    if (!addr) {
      setSelectedAddressId("");
      setAddress("");
      setPostcode("");
      return;
    }
    setSelectedAddressId(addr.id);
    const fullAddress = [addr.line1, addr.line2, addr.city].filter(Boolean).join(", ");
    setAddress(fullAddress);
    setPostcode(addr.postcode);
    clearError("address");
    clearError("postcode");
  };

  const addressDropdownOptions = [
    { value: "", label: "Enter new address" },
    ...savedAddresses.map((addr) => ({
      value: addr.id,
      label: `${addr.label} — ${addr.line1}, ${addr.postcode}`,
    })),
  ];

  // Auto-fill with default or first saved address when addresses first load from Supabase.
  useEffect(() => {
    if (savedAddresses.length > 0 && !address.trim() && !postcode.trim()) {
      const defaultAddr = savedAddresses.find((a) => a.isDefault) ?? savedAddresses[0];
      setSelectedAddressId(defaultAddr.id);
      const fullAddress = [defaultAddr.line1, defaultAddr.line2, defaultAddr.city].filter(Boolean).join(", ");
      setAddress(fullAddress);
      setPostcode(defaultAddr.postcode);
    }
  }, [savedAddresses]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!estimate || !serviceId) {
    setStep(4);
    return null;
  }

  const service = getService(serviceId);
  const category = categoryId ? getCategory(categoryId) : null;

  const handleBlur = (field: keyof FieldErrors) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const all = validate(address, postcode, preferredDate, preferredTime);
    setErrors((prev) => ({ ...prev, [field]: all[field] }));
  };

  const clearError = (field: keyof FieldErrors) => {
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleContinue = () => {
    const all = validate(address, postcode, preferredDate, preferredTime);
    setErrors(all);
    setTouched({ address: true, postcode: true, preferredDate: true, preferredTime: true });

    if (Object.keys(all).length === 0) {
      setStep(6);
    }
  };

  const fieldError = (field: keyof FieldErrors) =>
    touched[field] && errors[field] ? errors[field] : null;

  return (
    <div>
      <button
        onClick={() => setStep(4)}
        className="mb-4 flex items-center gap-1 text-sm text-slate-400 transition-colors hover:text-slate-600"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back
      </button>

      <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Your Quote</h1>
      <p className="mt-1 text-sm text-slate-500">
        Review your estimate and add scheduling details
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left column — quote & summary */}
        <div className="space-y-5">
          <PriceEstimateCard estimate={estimate} />

          <div className="card space-y-1">
            <h3 className="text-sm font-semibold text-slate-900">Job Summary</h3>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Type</span>
              <span className="font-medium capitalize text-slate-700">{cleaningType}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Category</span>
              <span className="font-medium text-slate-700">{category?.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Service</span>
              <span className="font-medium text-slate-700">{service?.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Size</span>
              <span className="font-medium text-slate-700">
                {details[0]?.size === "S" ? "Small" : details[0]?.size === "M" ? "Medium" : "Large"}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Areas</span>
              <span className="font-medium text-slate-700">{details[0]?.quantity}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Depth</span>
              <span className="font-medium capitalize text-slate-700">{details[0]?.complexity}</span>
            </div>
          </div>
        </div>

        {/* Right column — location & schedule */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">Location & Schedule</h3>

          {/* Booking as: Personal / Business */}
          <div>
            <label className="block text-sm font-medium text-slate-700">Booking as</label>
            <p className="mt-0.5 text-xs text-slate-500">Choose how this job will be billed and under which account</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setBookingAs("personal")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl border-2 py-2.5 text-sm font-medium transition-all ${
                  bookingAs === "personal"
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                <User className="h-4 w-4" />
                Personal
              </button>
              <button
                type="button"
                onClick={() => setBookingAs("business")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl border-2 py-2.5 text-sm font-medium transition-all ${
                  bookingAs === "business"
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                <Building2 className="h-4 w-4" />
                Business
              </button>
            </div>
            {bookingAs === "business" && (
              <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                {businessName ? (
                  <p className="text-sm font-medium text-slate-700">{businessName}</p>
                ) : (
                  <p className="text-sm text-slate-600">No business details saved yet.</p>
                )}
                <Link href="/dashboard/account" className="mt-1 inline-block text-xs font-medium text-brand-600 hover:underline">
                  Manage business details in Account →
                </Link>
              </div>
            )}
          </div>

          {/* Address dropdown */}
          {savedAddresses.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700">Choose from your addresses</label>
              <p className="mt-0.5 text-xs text-slate-500">Select an address below or choose &quot;Enter new address&quot; to type one</p>
              <div className="mt-1.5">
                <CustomDropdown
                  value={selectedAddressId}
                  onChange={(value) => {
                    if (value === "") handleSelectAddress(null);
                    else {
                      const addr = savedAddresses.find((a) => a.id === value);
                      if (addr) handleSelectAddress(addr);
                    }
                  }}
                  options={addressDropdownOptions}
                  icon={Home}
                  placeholder="Select address"
                  className="w-full"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700">
              Address <span className="text-red-400">*</span>
            </label>
            <div className="relative mt-1">
              <MapPin className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={address}
                onChange={(e) => {
                  setSelectedAddressId("");
                  setAddress(e.target.value);
                  clearError("address");
                }}
                onBlur={() => handleBlur("address")}
                className={`input-field pl-10 ${fieldError("address") ? "border-red-400 focus:border-red-400 focus:ring-red-400/20" : ""}`}
                placeholder="123 High Street, London"
              />
            </div>
            {fieldError("address") && (
              <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                <AlertCircle className="h-3 w-3" />
                {fieldError("address")}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              Postcode <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={postcode}
              onChange={(e) => {
                setSelectedAddressId("");
                setPostcode(e.target.value.toUpperCase());
                clearError("postcode");
              }}
              onBlur={() => handleBlur("postcode")}
              className={`input-field mt-1 ${fieldError("postcode") ? "border-red-400 focus:border-red-400 focus:ring-red-400/20" : ""}`}
              placeholder="SW1A 1AA"
            />
            {fieldError("postcode") && (
              <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                <AlertCircle className="h-3 w-3" />
                {fieldError("postcode")}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              Preferred Date <span className="text-red-400">*</span>
            </label>
            <div className="relative mt-1">
              <Calendar className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
              <input
                type="date"
                value={preferredDate}
                onChange={(e) => {
                  setPreferredDate(e.target.value);
                  clearError("preferredDate");
                }}
                onBlur={() => handleBlur("preferredDate")}
                className={`input-field pl-10 ${fieldError("preferredDate") ? "border-red-400 focus:border-red-400 focus:ring-red-400/20" : ""}`}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>
            {fieldError("preferredDate") && (
              <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                <AlertCircle className="h-3 w-3" />
                {fieldError("preferredDate")}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              Preferred Time <span className="text-red-400">*</span>
            </label>
            <div className="relative mt-1">
              <Clock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
              <input
                type="time"
                value={preferredTime}
                onChange={(e) => {
                  setPreferredTime(e.target.value);
                  clearError("preferredTime");
                }}
                onBlur={() => handleBlur("preferredTime")}
                className={`input-field pl-10 ${fieldError("preferredTime") ? "border-red-400 focus:border-red-400 focus:ring-red-400/20" : ""}`}
              />
            </div>
            {fieldError("preferredTime") && (
              <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                <AlertCircle className="h-3 w-3" />
                {fieldError("preferredTime")}
              </p>
            )}
          </div>
        </div>
      </div>

      <button
        onClick={handleContinue}
        className="btn-primary mt-6 w-full gap-2 py-3.5 lg:w-auto lg:px-12"
      >
        Continue to Payment
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}
