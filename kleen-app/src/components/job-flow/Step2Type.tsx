"use client";

import { useJobFlowStore } from "@/lib/store";
import { CleaningType } from "@/types";
import { Home, Building2, ArrowLeft } from "lucide-react";

const TYPES: { value: CleaningType; label: string; desc: string; icon: React.ElementType }[] = [
  {
    value: "domestic",
    label: "Domestic",
    desc: "Homes, flats, gardens, and driveways",
    icon: Home,
  },
  {
    value: "commercial",
    label: "Commercial",
    desc: "Offices, retail, warehouses, and businesses",
    icon: Building2,
  },
];

export default function Step2Type() {
  const { cleaningType, setCleaningType, setStep } = useJobFlowStore();

  const handleSelect = (type: CleaningType) => {
    setCleaningType(type);
    setStep(3);
  };

  return (
    <div>
      <button
        onClick={() => setStep(1)}
        className="mb-4 flex items-center gap-1 text-sm text-slate-400 transition-colors hover:text-slate-600"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back
      </button>

      <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">What type of cleaning?</h1>
      <p className="mt-1 text-sm text-slate-500">
        Select whether this is for a home or a commercial property.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {TYPES.map((type) => {
          const Icon = type.icon;
          const selected = cleaningType === type.value;
          return (
            <button
              key={type.value}
              onClick={() => handleSelect(type.value)}
              className={`group rounded-2xl border-2 p-8 text-left transition-all ${
                selected
                  ? "border-brand-500 bg-brand-50 shadow-md shadow-brand-500/10"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
              }`}
            >
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-2xl transition-colors ${
                  selected ? "bg-brand-100" : "bg-slate-100 group-hover:bg-slate-200"
                }`}
              >
                <Icon className={`h-7 w-7 ${selected ? "text-brand-600" : "text-slate-500"}`} />
              </div>
              <h3 className={`mt-4 text-lg font-semibold ${selected ? "text-brand-700" : "text-slate-900"}`}>
                {type.label}
              </h3>
              <p className="mt-1 text-sm text-slate-500">{type.desc}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
