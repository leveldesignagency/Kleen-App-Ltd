"use client";

import { useState } from "react";
import { useJobFlowStore } from "@/lib/store";
import { getService, getCategory } from "@/lib/services";
import PriceEstimateCard from "@/components/ui/PriceEstimateCard";
import { ArrowLeft, ArrowRight, MapPin, Calendar, Clock, AlertCircle, Home, ChevronDown } from "lucide-react";
import { useAddressStore } from "@/lib/addresses";

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
  const savedAddresses = useAddressStore((s) => s.addresses);

  const handleSelectAddress = (addr: { line1: string; postcode: string }) => {
    setAddress(addr.line1);
    setPostcode(addr.postcode);
    clearError("address");
    clearError("postcode");
  };

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

          {savedAddresses.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-500">Saved addresses</label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {savedAddresses.map((addr) => {
                  const isSelected = address === addr.line1 && postcode === addr.postcode;
                  return (
                    <button
                      key={addr.id}
                      type="button"
                      onClick={() => handleSelectAddress(addr)}
                      className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-left text-xs transition-all ${
                        isSelected
                          ? "border-brand-500 bg-brand-50 text-brand-700"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <Home className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>
                        <span className="font-semibold">{addr.label}</span>
                        <span className="ml-1 text-slate-400">{addr.postcode}</span>
                      </span>
                    </button>
                  );
                })}
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
