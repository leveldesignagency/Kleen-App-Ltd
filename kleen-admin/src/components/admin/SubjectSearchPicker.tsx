"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Search, X, Building2, User, Briefcase } from "lucide-react";

export type SubjectKind = "customer" | "contractor" | "job";

export type SelectedSubject = {
  id: string;
  kind: SubjectKind;
  title: string;
  subtitle: string;
};

type SearchHit = {
  id: string;
  type: SubjectKind;
  title: string;
  subtitle: string;
};

const KIND_META: Record<
  SubjectKind,
  { label: string; placeholder: string; Icon: typeof User }
> = {
  customer: {
    label: "Customer",
    placeholder: "Search by name, email, or phone…",
    Icon: User,
  },
  contractor: {
    label: "Contractor",
    placeholder: "Search by company, name, email, or address…",
    Icon: Building2,
  },
  job: {
    label: "Job",
    placeholder: "Search by job reference, postcode, or address…",
    Icon: Briefcase,
  },
};

type Props = {
  kind: SubjectKind;
  value: SelectedSubject | null;
  onChange: (value: SelectedSubject | null) => void;
  disabled?: boolean;
};

export default function SubjectSearchPicker({ kind, value, onChange, disabled }: Props) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const meta = KIND_META[kind];

  useEffect(() => {
    // Clear selection when switching subject kind (search results are type-specific).
    setQuery("");
    setHits([]);
    setOpen(false);
    onChange(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reset on kind change
  }, [kind]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(
            `/api/admin/search?q=${encodeURIComponent(q)}&types=${encodeURIComponent(kind)}`,
            { credentials: "include" },
          );
          const json = (await res.json().catch(() => ({}))) as {
            results?: Array<{ id: string; type: string; title: string; subtitle: string }>;
          };
          if (cancelled) return;
          const mapped = (json.results || [])
            .filter((r) => r.type === kind)
            .map((r) => ({
              id: r.id,
              type: kind,
              title: r.title,
              subtitle: r.subtitle,
            }));
          setHits(mapped);
          setOpen(true);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [query, kind]);

  if (value) {
    const Icon = meta.Icon;
    return (
      <div className="rounded-xl border border-brand-500/30 bg-brand-500/10 px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-500/20 text-brand-300">
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-300/80">
                Selected {meta.label.toLowerCase()}
              </p>
              <p className="truncate text-sm font-semibold text-white">{value.title}</p>
              <p className="truncate text-xs text-slate-400">{value.subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(null)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-50"
            aria-label="Clear selection"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative">
      <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Find {meta.label.toLowerCase()}
      </label>
      <div className="relative mt-1.5">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          value={query}
          disabled={disabled}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => hits.length > 0 && setOpen(true)}
          placeholder={meta.placeholder}
          className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-10 text-sm text-white placeholder:text-slate-500 outline-none focus:border-brand-500 disabled:opacity-50"
          autoComplete="off"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-brand-400" />
        )}
      </div>
      <p className="mt-1.5 text-[11px] text-slate-500">
        Search by the details staff already know — no need to paste an internal ID.
      </p>

      {open && query.trim().length >= 2 && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-white/10 bg-slate-900 shadow-xl">
          {hits.length === 0 && !loading ? (
            <li className="px-3 py-3 text-sm text-slate-500">No matches.</li>
          ) : (
            hits.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange({
                      id: h.id,
                      kind: h.type,
                      title: h.title,
                      subtitle: h.subtitle,
                    });
                    setOpen(false);
                    setQuery("");
                    setHits([]);
                  }}
                  className="flex w-full flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-white/5"
                >
                  <span className="text-sm font-medium text-slate-100">{h.title}</span>
                  <span className="text-xs text-slate-500">{h.subtitle}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
