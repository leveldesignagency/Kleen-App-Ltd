"use client";

import { Check } from "lucide-react";
import type { AdminPermission } from "@/lib/admin-permissions";
import { PERMISSION_LABELS } from "@/lib/admin-permissions";

type Props = {
  permissions: AdminPermission[];
  selected: AdminPermission[];
  onChange: (next: AdminPermission[]) => void;
  disabled?: boolean;
};

export default function PermissionCheckboxGrid({
  permissions,
  selected,
  onChange,
  disabled,
}: Props) {
  const set = new Set(selected);

  const toggle = (perm: AdminPermission) => {
    if (disabled) return;
    if (set.has(perm)) {
      onChange(selected.filter((p) => p !== perm));
    } else {
      onChange([...selected, perm]);
    }
  };

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {permissions.map((perm) => {
        const on = set.has(perm);
        return (
          <button
            key={perm}
            type="button"
            disabled={disabled}
            onClick={() => toggle(perm)}
            className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
              disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-white/[0.04]"
            } ${on ? "border-brand-500/40 bg-brand-500/10 text-brand-200" : "border-white/10 text-slate-300"}`}
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                on ? "border-brand-500 bg-brand-500 text-white" : "border-white/20 bg-white/5"
              }`}
            >
              {on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
            </span>
            <span className="text-xs leading-snug">{PERMISSION_LABELS[perm]}</span>
          </button>
        );
      })}
    </div>
  );
}
