"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AlertCircle, Loader2, MapPin } from "lucide-react";
import { normalizeUkPostcode } from "@/lib/format-uk-address";

export type UkAddressAutocompleteProps = {
  address: string;
  postcode: string;
  onAddressChange: (address: string) => void;
  onPostcodeChange: (postcode: string) => void;
  onBlur?: () => void;
  addressError?: string | null;
  postcodeError?: string | null;
  disabled?: boolean;
  addressPlaceholder?: string;
  postcodePlaceholder?: string;
};

type PostcodeMeta = {
  admin_district?: string;
  parish?: string;
  region?: string;
};

export default function UkAddressAutocomplete({
  address,
  postcode,
  onAddressChange,
  onPostcodeChange,
  onBlur,
  addressError,
  postcodeError,
  disabled = false,
  addressPlaceholder = "House name/number and street",
  postcodePlaceholder = "Start typing your postcode…",
}: UkAddressAutocompleteProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [postcodeSuggestions, setPostcodeSuggestions] = useState<string[]>([]);
  const [postcodeOpen, setPostcodeOpen] = useState(false);
  const [postcodeLoading, setPostcodeLoading] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [areaHint, setAreaHint] = useState<string | null>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setPostcodeOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    const partial = postcode.replace(/\s+/g, "").trim();
    if (disabled || partial.length < 2) {
      setPostcodeSuggestions([]);
      setPostcodeOpen(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setPostcodeLoading(true);
      try {
        const res = await fetch(
          `https://api.postcodes.io/postcodes/${encodeURIComponent(partial)}/autocomplete?limit=8`,
          { signal: controller.signal },
        );
        if (!res.ok) {
          setPostcodeSuggestions([]);
          setPostcodeOpen(false);
          return;
        }
        const json = (await res.json()) as { result?: string[] };
        const list = json.result || [];
        setPostcodeSuggestions(list);
        setPostcodeOpen(list.length > 0);
        setHighlight(-1);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setPostcodeSuggestions([]);
        setPostcodeOpen(false);
      } finally {
        if (!controller.signal.aborted) setPostcodeLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [postcode, disabled]);

  const loadAreaHint = async (pc: string) => {
    const norm = normalizeUkPostcode(pc);
    if (!norm) {
      setAreaHint(null);
      return;
    }
    try {
      const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(norm)}`);
      if (!res.ok) {
        setAreaHint(null);
        return;
      }
      const json = (await res.json()) as { result?: PostcodeMeta };
      const r = json.result;
      if (!r) {
        setAreaHint(null);
        return;
      }
      const parts = [r.parish, r.admin_district, r.region].filter(Boolean);
      setAreaHint(parts.length ? parts.join(", ") : null);
    } catch {
      setAreaHint(null);
    }
  };

  const pickPostcode = (pc: string) => {
    onPostcodeChange(pc);
    setPostcodeOpen(false);
    setPostcodeSuggestions([]);
    void loadAreaHint(pc);
  };

  const onPostcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!postcodeOpen || postcodeSuggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % postcodeSuggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h <= 0 ? postcodeSuggestions.length - 1 : h - 1));
    } else if (e.key === "Enter" && highlight >= 0) {
      e.preventDefault();
      pickPostcode(postcodeSuggestions[highlight]);
    } else if (e.key === "Escape") {
      setPostcodeOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="space-y-4">
      <div className="relative">
        <label className="block text-sm font-medium text-slate-700">
          Postcode <span className="text-red-400">*</span>
        </label>
        <p className="mt-0.5 text-xs text-slate-500">Start with your postcode — we&apos;ll suggest matches as you type</p>
        <div className="relative mt-1">
          <input
            type="text"
            value={postcode}
            disabled={disabled}
            autoComplete="postal-code"
            role="combobox"
            aria-expanded={postcodeOpen}
            aria-controls={listId}
            aria-autocomplete="list"
            onChange={(e) => {
              onPostcodeChange(e.target.value.toUpperCase());
              setAreaHint(null);
            }}
            onFocus={() => {
              if (postcodeSuggestions.length > 0) setPostcodeOpen(true);
            }}
            onBlur={() => {
              window.setTimeout(() => {
                setPostcodeOpen(false);
                onBlur?.();
              }, 150);
            }}
            onKeyDown={onPostcodeKeyDown}
            className={`input-field pr-10 ${postcodeError ? "border-red-400 focus:border-red-400 focus:ring-red-400/20" : ""}`}
            placeholder={postcodePlaceholder}
          />
          {postcodeLoading && (
            <Loader2 className="absolute right-3.5 top-3.5 h-4 w-4 animate-spin text-brand-500" />
          )}
        </div>
        {postcodeOpen && postcodeSuggestions.length > 0 && (
          <ul
            id={listId}
            role="listbox"
            className="absolute left-0 right-0 z-40 mt-1 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg shadow-slate-200/50"
          >
            {postcodeSuggestions.map((pc, i) => (
              <li key={pc} role="option" aria-selected={i === highlight}>
                <button
                  type="button"
                  className={`w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-brand-50 ${
                    i === highlight ? "bg-brand-50" : ""
                  }`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickPostcode(pc)}
                >
                  {pc}
                </button>
              </li>
            ))}
          </ul>
        )}
        {areaHint && !postcodeError && (
          <p className="mt-1 text-xs text-slate-500">{areaHint}</p>
        )}
        {postcodeError && (
          <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
            <AlertCircle className="h-3 w-3" />
            {postcodeError}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">
          Address <span className="text-red-400">*</span>
        </label>
        <p className="mt-0.5 text-xs text-slate-500">House name or number and street</p>
        <div className="relative mt-1">
          <MapPin className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={address}
            disabled={disabled}
            autoComplete="address-line1"
            onChange={(e) => onAddressChange(e.target.value)}
            onBlur={() => window.setTimeout(() => onBlur?.(), 150)}
            className={`input-field pl-10 ${addressError ? "border-red-400 focus:border-red-400 focus:ring-red-400/20" : ""}`}
            placeholder={addressPlaceholder}
          />
        </div>
        {addressError && (
          <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
            <AlertCircle className="h-3 w-3" />
            {addressError}
          </p>
        )}
      </div>
    </div>
  );
}
