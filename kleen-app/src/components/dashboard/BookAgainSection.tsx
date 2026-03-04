"use client";

import { useRouter } from "next/navigation";
import { useJobFlowStore } from "@/lib/store";
import { getService, getCategory } from "@/lib/services";
import { CleaningType, RoomSize } from "@/types";
import { RefreshCw, Heart, MapPin, ArrowRight } from "lucide-react";

export interface SavedTemplate {
  id: string;
  serviceId: string;
  categoryId: string;
  cleaningType: CleaningType;
  size: RoomSize;
  quantity: number;
  complexity: "standard" | "deep";
  address: string;
  postcode: string;
  preferredTime: string;
  timesBooked: number;
  lastBookedAt: string;
  isFavourite: boolean;
}

/* TODO: replace with Supabase query */
const MOCK_TEMPLATES: SavedTemplate[] = [];

export default function BookAgainSection() {
  const router = useRouter();
  const prefill = useJobFlowStore((s) => s.prefill);

  const templates = MOCK_TEMPLATES;

  if (templates.length === 0) return null;

  const handleBookAgain = (tpl: SavedTemplate) => {
    prefill({
      cleaningType: tpl.cleaningType,
      categoryId: tpl.categoryId,
      serviceId: tpl.serviceId,
      size: tpl.size,
      quantity: tpl.quantity,
      complexity: tpl.complexity,
      address: tpl.address,
      postcode: tpl.postcode,
      preferredTime: tpl.preferredTime,
    });
    router.push("/job-flow");
  };

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4.5 w-4.5 text-brand-500" />
          <h2 className="text-lg font-semibold text-slate-900">Book Again</h2>
        </div>
      </div>
      <p className="mt-1 text-sm text-slate-500">Quickly rebook a previous clean</p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((tpl) => {
          const service = getService(tpl.serviceId);
          const category = getCategory(tpl.categoryId);
          if (!service) return null;

          return (
            <div
              key={tpl.id}
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:border-brand-300 hover:shadow-md"
            >
              {tpl.isFavourite && (
                <Heart className="absolute right-4 top-4 h-4 w-4 fill-red-400 text-red-400" />
              )}

              <p className="text-base font-semibold text-slate-900">{service.name}</p>
              <p className="mt-0.5 text-xs text-slate-400">
                {category?.name} &middot; {tpl.complexity === "deep" ? "Deep" : "Standard"} &middot; {tpl.size === "S" ? "Small" : tpl.size === "M" ? "Medium" : "Large"}
              </p>

              <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                <MapPin className="h-3 w-3 text-slate-400" />
                {tpl.address}, {tpl.postcode}
              </div>

              <div className="mt-1 text-xs text-slate-400">
                Booked {tpl.timesBooked} time{tpl.timesBooked !== 1 ? "s" : ""} &middot; Last{" "}
                {new Date(tpl.lastBookedAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                })}
              </div>

              <button
                onClick={() => handleBookAgain(tpl)}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-700 transition-all hover:bg-brand-100"
              >
                Book Again
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
