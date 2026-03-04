"use client";

import { RoomSize } from "@/types";

interface SizeSelectorProps {
  value: RoomSize;
  onChange: (size: RoomSize) => void;
}

const sizes: { value: RoomSize; label: string; desc: string }[] = [
  { value: "S", label: "Small", desc: "Compact area" },
  { value: "M", label: "Medium", desc: "Average area" },
  { value: "L", label: "Large", desc: "Spacious area" },
];

export default function SizeSelector({ value, onChange }: SizeSelectorProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {sizes.map((size) => (
        <button
          key={size.value}
          onClick={() => onChange(size.value)}
          className={`rounded-xl border-2 p-4 text-center transition-all ${
            value === size.value
              ? "border-brand-500 bg-brand-50 shadow-sm"
              : "border-slate-200 bg-white hover:border-slate-300"
          }`}
        >
          <div
            className={`mx-auto mb-2 rounded-lg ${
              value === size.value ? "bg-brand-100" : "bg-slate-100"
            } flex items-center justify-center`}
            style={{
              width: size.value === "S" ? 32 : size.value === "M" ? 44 : 56,
              height: size.value === "S" ? 32 : size.value === "M" ? 44 : 56,
            }}
          >
            <span className={`text-xs font-bold ${value === size.value ? "text-brand-700" : "text-slate-500"}`}>
              {size.value}
            </span>
          </div>
          <p className={`text-sm font-semibold ${value === size.value ? "text-brand-700" : "text-slate-700"}`}>
            {size.label}
          </p>
          <p className="text-xs text-slate-400">{size.desc}</p>
        </button>
      ))}
    </div>
  );
}
