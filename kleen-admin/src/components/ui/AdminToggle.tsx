"use client";

import { Check } from "lucide-react";

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
};

export default function AdminToggle({ checked, onChange, label, description, disabled }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`flex w-full cursor-pointer items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left transition ${
        disabled
          ? "cursor-not-allowed border-white/5 bg-white/[0.02] opacity-50"
          : checked
            ? "border-brand-500/30 bg-brand-500/5"
            : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"
      }`}
    >
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        {description && <p className="text-xs text-slate-500">{description}</p>}
      </div>
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition ${
          checked
            ? "border-brand-500 bg-brand-500 text-white"
            : "border-white/20 bg-white/5 text-transparent"
        }`}
      >
        <Check className="h-4 w-4" strokeWidth={3} />
      </span>
    </button>
  );
}
