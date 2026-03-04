"use client";

import { PriceEstimate } from "@/types";
import { formatDuration, formatPrice } from "@/lib/pricing";
import { Clock, Users } from "lucide-react";

interface PriceEstimateCardProps {
  estimate: PriceEstimate;
}

export default function PriceEstimateCard({ estimate }: PriceEstimateCardProps) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-slate-900">Estimated Quote</h3>
      <div className="rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white p-6">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-slate-900">
            {formatPrice(estimate.minPrice)}
          </span>
          <span className="text-lg text-slate-400">–</span>
          <span className="text-3xl font-bold text-slate-900">
            {formatPrice(estimate.maxPrice)}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 rounded-xl bg-white/60 p-3">
            <Clock className="h-4 w-4 text-brand-500" />
            <div>
              <p className="text-xs text-slate-400">Duration</p>
              <p className="text-sm font-semibold text-slate-700">
                {formatDuration(estimate.estimatedDuration)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-white/60 p-3">
            <Users className="h-4 w-4 text-brand-500" />
            <div>
              <p className="text-xs text-slate-400">Operatives</p>
              <p className="text-sm font-semibold text-slate-700">
                {estimate.operativesRequired}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
