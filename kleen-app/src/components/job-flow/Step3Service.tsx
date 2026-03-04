"use client";

import { useJobFlowStore } from "@/lib/store";
import { getCategoriesForType, getCategory } from "@/lib/services";
import { ArrowLeft, ChevronRight } from "lucide-react";
import * as Icons from "lucide-react";

export default function Step3Service() {
  const { cleaningType, categoryId, serviceId, setCategory, setService, setStep } =
    useJobFlowStore();

  if (!cleaningType) {
    setStep(2);
    return null;
  }

  const categories = getCategoriesForType(cleaningType);
  const selectedCategory = categoryId ? getCategory(categoryId) : null;

  const handleCategorySelect = (id: string) => {
    setCategory(id);
  };

  const handleServiceSelect = (id: string) => {
    setService(id);
    setStep(4);
  };

  const getIcon = (iconName: string) => {
    const IconComponent = (Icons as unknown as Record<string, React.ElementType>)[iconName];
    return IconComponent || Icons.Sparkles;
  };

  return (
    <div>
      <button
        onClick={() => {
          if (selectedCategory) {
            setCategory("");
          } else {
            setStep(2);
          }
        }}
        className="mb-4 flex items-center gap-1 text-sm text-slate-400 transition-colors hover:text-slate-600"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back
      </button>

      {!selectedCategory ? (
        <>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Choose a category</h1>
          <p className="mt-1 text-sm text-slate-500">
            What kind of cleaning do you need?
          </p>
          <div className="mt-6 space-y-3">
            {categories.map((cat) => {
              const Icon = getIcon(cat.icon);
              return (
                <button
                  key={cat.id}
                  onClick={() => handleCategorySelect(cat.id)}
                  className="group flex w-full items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-brand-200 hover:bg-brand-50/50 hover:shadow-sm"
                >
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 transition-colors group-hover:bg-brand-100">
                    <Icon className="h-5 w-5 text-brand-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-slate-900">{cat.name}</h3>
                    <p className="text-xs text-slate-500">{cat.description}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300 transition-colors group-hover:text-brand-400" />
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Select a service</h1>
          <p className="mt-1 text-sm text-slate-500">
            Choose from {selectedCategory.name.toLowerCase()}
          </p>
          <div className="mt-6 space-y-3">
            {selectedCategory.services
              .filter((s) => s.enabled)
              .map((service) => (
                <button
                  key={service.id}
                  onClick={() => handleServiceSelect(service.id)}
                  className={`group flex w-full items-center gap-4 rounded-xl border-2 p-4 text-left transition-all ${
                    serviceId === service.id
                      ? "border-brand-500 bg-brand-50"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                  }`}
                >
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-slate-900">{service.name}</h3>
                    <p className="text-xs text-slate-500">{service.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-brand-600">From £{service.basePrice}</p>
                    <p className="text-xs text-slate-400">~{Math.round(service.estimatedMinutes / 60)}h</p>
                  </div>
                </button>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
