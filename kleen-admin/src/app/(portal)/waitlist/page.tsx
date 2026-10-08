"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Mail, MapPin, Search } from "lucide-react";
import CustomDropdown from "@/components/ui/CustomDropdown";

type Entry = {
  id: string;
  email: string;
  postcode: string | null;
  audience: string;
  source: string | null;
  created_at: string;
  area_label: string | null;
  admin_county: string | null;
  admin_district: string | null;
  region: string | null;
  postcode_area: string | null;
};

function uniqueSorted(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map((v) => (v || "").trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, "en-GB"));
}

function outwardFromPostcode(postcode: string | null | undefined) {
  if (!postcode) return null;
  const part = postcode.trim().toUpperCase().split(/\s+/)[0];
  return part || null;
}

export default function WaitlistPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [audience, setAudience] = useState("all");
  const [county, setCounty] = useState("all");
  const [district, setDistrict] = useState("all");
  const [region, setRegion] = useState("all");
  const [postcodeArea, setPostcodeArea] = useState("all");
  const [search, setSearch] = useState("");

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

  const counties = useMemo(
    () => uniqueSorted(entries.map((e) => e.admin_county)),
    [entries],
  );
  const districts = useMemo(() => {
    const pool =
      county === "all"
        ? entries
        : entries.filter((e) => (e.admin_county || "") === county);
    return uniqueSorted(pool.map((e) => e.admin_district));
  }, [entries, county]);
  const regions = useMemo(
    () => uniqueSorted(entries.map((e) => e.region)),
    [entries],
  );
  const postcodeAreas = useMemo(
    () =>
      uniqueSorted(
        entries.map((e) => e.postcode_area || outwardFromPostcode(e.postcode)),
      ),
    [entries],
  );

  useEffect(() => {
    if (county !== "all" && !counties.includes(county)) setCounty("all");
  }, [counties, county]);

  useEffect(() => {
    if (district !== "all" && !districts.includes(district)) setDistrict("all");
  }, [districts, district]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (audience !== "all" && e.audience !== audience) return false;
      if (county !== "all" && (e.admin_county || "") !== county) return false;
      if (district !== "all" && (e.admin_district || "") !== district) return false;
      if (region !== "all" && (e.region || "") !== region) return false;
      const area = e.postcode_area || outwardFromPostcode(e.postcode) || "";
      if (postcodeArea !== "all" && area !== postcodeArea) return false;
      if (!q) return true;
      return (
        e.email.toLowerCase().includes(q) ||
        (e.postcode || "").toLowerCase().includes(q) ||
        (e.area_label || "").toLowerCase().includes(q) ||
        (e.admin_county || "").toLowerCase().includes(q) ||
        (e.admin_district || "").toLowerCase().includes(q) ||
        (e.region || "").toLowerCase().includes(q) ||
        area.toLowerCase().includes(q) ||
        (e.source || "").toLowerCase().includes(q)
      );
    });
  }, [entries, audience, county, district, region, postcodeArea, search]);

  const clearFilters = () => {
    setAudience("all");
    setCounty("all");
    setDistrict("all");
    setRegion("all");
    setPostcodeArea("all");
    setSearch("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
          <Mail className="h-6 w-6 text-brand-400" />
          Area waitlist
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          People outside Kent who asked to be emailed when Kleen expands to their area. Filter by audience,
          county, district, region, or postcode area.
        </p>
      </div>

      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search email, postcode, county, area…"
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-sm text-slate-200 placeholder:text-slate-500 outline-none focus:border-brand-500"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <CustomDropdown
            value={audience}
            onChange={setAudience}
            options={[
              { value: "all", label: "All audiences" },
              { value: "customer", label: "Customers" },
              { value: "contractor", label: "Contractors" },
            ]}
          />
          <CustomDropdown
            value={county}
            onChange={(v) => {
              setCounty(v);
              setDistrict("all");
            }}
            options={[
              { value: "all", label: "All counties" },
              ...counties.map((c) => ({ value: c, label: c })),
            ]}
          />
          <CustomDropdown
            value={district}
            onChange={setDistrict}
            options={[
              { value: "all", label: "All districts" },
              ...districts.map((d) => ({ value: d, label: d })),
            ]}
          />
          <CustomDropdown
            value={region}
            onChange={setRegion}
            options={[
              { value: "all", label: "All regions" },
              ...regions.map((r) => ({ value: r, label: r })),
            ]}
          />
          <CustomDropdown
            value={postcodeArea}
            onChange={setPostcodeArea}
            options={[
              { value: "all", label: "All postcode areas" },
              ...postcodeAreas.map((a) => ({ value: a, label: a })),
            ]}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/5"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-400 hover:bg-white/5"
          >
            Clear filters
          </button>
          <span className="text-xs text-slate-500">
            {filtered.length} of {entries.length} entries
          </span>
        </div>
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
        <p className="text-sm text-slate-500">No waitlist sign-ups match these filters.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="admin-table-head px-4 py-3">Email</th>
                <th className="admin-table-head px-4 py-3">Audience</th>
                <th className="admin-table-head px-4 py-3">Postcode</th>
                <th className="admin-table-head px-4 py-3">Area</th>
                <th className="admin-table-head px-4 py-3">County</th>
                <th className="admin-table-head px-4 py-3">District</th>
                <th className="admin-table-head px-4 py-3">Region</th>
                <th className="admin-table-head px-4 py-3">Source</th>
                <th className="admin-table-head px-4 py-3">Joined</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const area = e.postcode_area || outwardFromPostcode(e.postcode);
                return (
                  <tr key={e.id} className="border-b border-white/5 last:border-0">
                    <td className="admin-table-row px-4 py-3 font-medium text-white">{e.email}</td>
                    <td className="admin-table-row px-4 py-3 capitalize text-slate-300">{e.audience}</td>
                    <td className="admin-table-row px-4 py-3 font-mono text-xs text-slate-400">
                      {e.postcode ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {e.postcode}
                          {area ? <span className="text-slate-600">({area})</span> : null}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="admin-table-row max-w-[180px] truncate px-4 py-3 text-xs text-slate-400" title={e.area_label || undefined}>
                      {e.area_label || "—"}
                    </td>
                    <td className="admin-table-row px-4 py-3 text-xs text-slate-400">{e.admin_county || "—"}</td>
                    <td className="admin-table-row px-4 py-3 text-xs text-slate-400">{e.admin_district || "—"}</td>
                    <td className="admin-table-row px-4 py-3 text-xs text-slate-400">{e.region || "—"}</td>
                    <td className="admin-table-row px-4 py-3 text-xs text-slate-500">{e.source || "—"}</td>
                    <td className="admin-table-row px-4 py-3 text-xs text-slate-500">
                      {new Date(e.created_at).toLocaleString("en-GB")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
