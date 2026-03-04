"use client";

import { useJobFlowStore } from "@/lib/store";
import { getService } from "@/lib/services";
import SizeSelector from "@/components/ui/SizeSelector";
import QuantitySlider from "@/components/ui/QuantitySlider";
import PriceEstimateCard from "@/components/ui/PriceEstimateCard";
import { ArrowLeft, ArrowRight, Zap } from "lucide-react";
import { RoomSize } from "@/types";

export default function Step4Details() {
  const {
    serviceId,
    details,
    updateDetail,
    estimate,
    setStep,
  } = useJobFlowStore();

  if (!serviceId || details.length === 0) {
    setStep(3);
    return null;
  }

  const service = getService(serviceId);
  const detail = details[0];

  return (
    <div>
      <button
        onClick={() => setStep(3)}
        className="mb-4 flex items-center gap-1 text-sm text-slate-400 transition-colors hover:text-slate-600"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back
      </button>

      <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Job Details</h1>
      <p className="mt-1 text-sm text-slate-500">
        Customise your {service?.name?.toLowerCase()} requirements
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left column */}
        <div className="space-y-6">
          <div>
            <label className="mb-3 block text-sm font-semibold text-slate-900">
              Area Size
            </label>
            <SizeSelector
              value={detail.size}
              onChange={(size: RoomSize) => updateDetail(0, { size })}
            />
          </div>

          <QuantitySlider
            label="Number of areas / rooms"
            value={detail.quantity}
            min={1}
            max={10}
            onChange={(quantity) => updateDetail(0, { quantity })}
          />
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <div>
            <label className="mb-3 block text-sm font-semibold text-slate-900">
              Cleaning Depth
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => updateDetail(0, { complexity: "standard" })}
                className={`rounded-xl border-2 p-4 text-center transition-all ${
                  detail.complexity === "standard"
                    ? "border-brand-500 bg-brand-50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <p className={`text-sm font-semibold ${detail.complexity === "standard" ? "text-brand-700" : "text-slate-700"}`}>
                  Standard
                </p>
                <p className="text-xs text-slate-400">Regular clean</p>
              </button>
              <button
                onClick={() => updateDetail(0, { complexity: "deep" })}
                className={`rounded-xl border-2 p-4 text-center transition-all ${
                  detail.complexity === "deep"
                    ? "border-brand-500 bg-brand-50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-center gap-1">
                  <Zap className={`h-3.5 w-3.5 ${detail.complexity === "deep" ? "text-brand-600" : "text-slate-400"}`} />
                  <p className={`text-sm font-semibold ${detail.complexity === "deep" ? "text-brand-700" : "text-slate-700"}`}>
                    Deep Clean
                  </p>
                </div>
                <p className="text-xs text-slate-400">Intensive treatment</p>
              </button>
            </div>
          </div>

          {estimate && (
            <div className="animate-in fade-in slide-in-from-bottom-2">
              <PriceEstimateCard estimate={estimate} />
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() => setStep(5)}
        className="btn-primary mt-6 w-full gap-2 py-3.5 lg:w-auto lg:px-12"
      >
        Continue to Quote
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}
