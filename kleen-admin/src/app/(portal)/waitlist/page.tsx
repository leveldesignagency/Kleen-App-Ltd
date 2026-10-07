"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Mail, MapPin } from "lucide-react";
import CustomDropdown from "@/components/ui/CustomDropdown";

type Entry = {
  id: string;
  email: string;
  postcode: string | null;
  audience: string;
  source: string | null;
  created_at: string;
};

export default function WaitlistPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [audience, setAudience] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetch("/api/waitlist", { credentials: "include" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || "Could not load waitlist");
      setEntries([]);
    } else {
      setEntries(json.entries || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered =
    audience === "all" ? entries : entries.filter((e) => e.audience === audience);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
          <Mail className="h-6 w-6 text-brand-400" />
          Area waitlist
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          People outside Kent who asked to be emailed when Kleen expands to their area.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-48">
          <CustomDropdown
            value={audience}
            onChange={setAudience}
            options={[
              { value: "all", label: "All audiences" },
              { value: "customer", label: "Customers" },
              { value: "contractor", label: "Contractors" },
            ]}
          />
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/5"
        >
          Refresh
        </button>
        <span className="text-xs text-slate-500">{filtered.length} entries</span>
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-500">No waitlist sign-ups yet.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="admin-table-head px-4 py-3">Email</th>
                <th className="admin-table-head px-4 py-3">Audience</th>
                <th className="admin-table-head px-4 py-3">Postcode</th>
                <th className="admin-table-head px-4 py-3">Source</th>
                <th className="admin-table-head px-4 py-3">Joined</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="border-b border-white/5 last:border-0">
                  <td className="admin-table-row px-4 py-3 font-medium text-white">{e.email}</td>
                  <td className="admin-table-row px-4 py-3 capitalize text-slate-300">{e.audience}</td>
                  <td className="admin-table-row px-4 py-3 font-mono text-xs text-slate-400">
                    {e.postcode ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {e.postcode}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="admin-table-row px-4 py-3 text-xs text-slate-500">{e.source || "—"}</td>
                  <td className="admin-table-row px-4 py-3 text-xs text-slate-500">
                    {new Date(e.created_at).toLocaleString("en-GB")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
