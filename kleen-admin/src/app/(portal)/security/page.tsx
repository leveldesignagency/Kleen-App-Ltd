"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  Globe,
  Loader2,
  RefreshCw,
  Shield,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { useAdminStaff } from "@/components/admin/AdminStaffProvider";
import type { SecurityWatchdog } from "@/lib/security/watchdog";

function BarChart({
  items,
  unit,
  accent = "bg-brand-500",
}: {
  items: { label: string; value: number }[];
  unit?: string;
  accent?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-slate-400">{item.label}</span>
            <span className="font-medium tabular-nums text-white">
              {item.value.toLocaleString()}
              {unit ? ` ${unit}` : ""}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/5">
            <div
              className={`h-full rounded-full ${accent} transition-all duration-500`}
              style={{ width: `${Math.max(4, (item.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function gradeColor(grade: string) {
  if (grade === "A") return "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
  if (grade === "B") return "text-brand-300 border-brand-500/30 bg-brand-500/10";
  if (grade === "C") return "text-amber-300 border-amber-500/30 bg-amber-500/10";
  if (grade === "D") return "text-orange-300 border-orange-500/30 bg-orange-500/10";
  return "text-red-300 border-red-500/30 bg-red-500/10";
}

function severityStyles(sev: string) {
  if (sev === "critical") return "border-red-500/25 bg-red-500/10 text-red-100";
  if (sev === "warn") return "border-amber-500/25 bg-amber-500/10 text-amber-100";
  return "border-white/10 bg-white/[0.03] text-slate-200";
}

export default function SecurityWatchdogPage() {
  const { hasPermission, loading: staffLoading } = useAdminStaff();
  const canView = hasPermission("security.view");
  const [data, setData] = useState<SecurityWatchdog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (soft = false) => {
    if (soft) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/security?full=1", { credentials: "include" });
      const json = (await res.json().catch(() => ({}))) as {
        watchdog?: SecurityWatchdog | null;
        error?: string;
      };
      if (!res.ok) {
        setError(json.error || `Request failed (${res.status})`);
        setData(null);
        return;
      }
      if (!json.watchdog) {
        setError(json.error || "Watchdog unavailable — check SUPABASE_SERVICE_ROLE_KEY on admin.");
        setData(null);
        return;
      }
      setData(json.watchdog);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (staffLoading) return;
    if (!canView) {
      setLoading(false);
      return;
    }
    void load();
    const id = window.setInterval(() => void load(true), 60_000);
    return () => window.clearInterval(id);
  }, [staffLoading, canView, load]);

  const criticalCount = useMemo(
    () => data?.alerts.filter((a) => a.severity === "critical").length ?? 0,
    [data],
  );

  if (staffLoading || loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
        <ShieldAlert className="mx-auto h-8 w-8 text-slate-500" />
        <p className="mt-3 text-sm text-slate-400">You do not have permission to view Security.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-brand-400">
            <Shield className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-widest">Security Watchdog</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold text-white">Platform health &amp; threat posture</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Live checks across Kleen surfaces, database health, and admin security configuration.
            Auto-refreshes every 60s.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-white/10 disabled:opacity-50"
        >
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh now
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className={`rounded-2xl border p-5 ${gradeColor(data.grade)}`}>
              <p className="text-xs font-medium uppercase tracking-wide opacity-80">Health score</p>
              <div className="mt-2 flex items-end gap-3">
                <span className="text-4xl font-bold tabular-nums">{data.score}</span>
                <span className="mb-1 text-lg font-semibold">/ 100 · {data.grade}</span>
              </div>
              <p className="mt-2 text-xs opacity-70">
                Updated {new Date(data.generatedAt).toLocaleTimeString("en-GB")}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Database</p>
              <div className="mt-2 flex items-center gap-2">
                {data.database.ok ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-400" />
                )}
                <span className="text-lg font-semibold text-white">
                  {data.database.ok ? "Healthy" : "Down"}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                {data.database.latencyMs != null ? `${data.database.latencyMs}ms` : "—"} query ·{" "}
                {data.database.counts.admins ?? "—"} admin profiles
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Surfaces</p>
              <p className="mt-2 text-lg font-semibold text-white">
                {data.surfaces.filter((s) => s.ok).length}/{data.surfaces.length} up
              </p>
              <p className="mt-2 text-xs text-slate-400">
                Marketing · Admin · Dashboard · Contractor
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Alerts</p>
              <p className="mt-2 text-lg font-semibold text-white">
                {criticalCount} critical · {data.alerts.length} total
              </p>
              <p className="mt-2 text-xs text-slate-400">
                Rate-limit blocks: {data.posture.rateLimitBlockedHits}
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <div className="mb-4 flex items-center gap-2">
                <Activity className="h-4 w-4 text-brand-400" />
                <h2 className="text-sm font-semibold text-white">Surface latency</h2>
              </div>
              <BarChart items={data.charts.surfaceLatencyMs} unit="ms" accent="bg-cyan-500" />
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <div className="mb-4 flex items-center gap-2">
                <Database className="h-4 w-4 text-brand-400" />
                <h2 className="text-sm font-semibold text-white">Data volume</h2>
              </div>
              <BarChart items={data.charts.volumeBars} accent="bg-brand-500" />
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <div className="mb-4 flex items-center gap-2">
              <Globe className="h-4 w-4 text-brand-400" />
              <h2 className="text-sm font-semibold text-white">Site &amp; subdomain probes</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-500">
                    <th className="pb-3 font-medium">Surface</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">HTTP</th>
                    <th className="pb-3 font-medium">Latency</th>
                    <th className="pb-3 font-medium">URL</th>
                  </tr>
                </thead>
                <tbody>
                  {data.surfaces.map((s) => (
                    <tr key={s.id} className="border-b border-white/5">
                      <td className="py-3 font-medium text-white">{s.label}</td>
                      <td className="py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                            s.ok
                              ? "bg-emerald-500/15 text-emerald-300"
                              : "bg-red-500/15 text-red-300"
                          }`}
                        >
                          {s.ok ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5" />
                          )}
                          {s.ok ? "Up" : "Down"}
                        </span>
                      </td>
                      <td className="py-3 tabular-nums text-slate-300">{s.status ?? "—"}</td>
                      <td className="py-3 tabular-nums text-slate-300">
                        {s.latencyMs != null ? `${s.latencyMs}ms` : "—"}
                      </td>
                      <td className="py-3">
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand-400 hover:underline"
                        >
                          {s.url.replace(/^https?:\/\//, "")}
                        </a>
                        {s.error && <p className="mt-0.5 text-xs text-red-300/90">{s.error}</p>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <div className="mb-4 flex items-center gap-2">
                <Database className="h-4 w-4 text-brand-400" />
                <h2 className="text-sm font-semibold text-white">Database snapshot</h2>
              </div>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                {[
                  ["Profiles", data.database.counts.profiles],
                  ["Jobs", data.database.counts.jobs],
                  ["Contractors", data.database.counts.operatives],
                  ["Payments", data.database.counts.payments],
                  ["Open disputes", data.database.counts.disputesOpen],
                  ["Active legal holds", data.database.counts.legalHoldsActive],
                  ["Active bans", data.database.counts.bansActive],
                  ["Admin users", data.database.counts.admins],
                  ["Deletions scheduled", data.database.counts.deletionScheduled],
                ].map(([label, value]) => (
                  <div key={String(label)} className="flex justify-between gap-3 border-b border-white/5 pb-2">
                    <dt className="text-slate-500">{label}</dt>
                    <dd className="font-medium tabular-nums text-white">
                      {value == null ? "—" : Number(value).toLocaleString()}
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <Link href="/legal-holds" className="rounded-lg border border-white/10 px-3 py-1.5 text-slate-300 hover:bg-white/5">
                  Legal holds
                </Link>
                <Link href="/enforcement" className="rounded-lg border border-white/10 px-3 py-1.5 text-slate-300 hover:bg-white/5">
                  Enforcement
                </Link>
                <Link href="/settings?tab=security" className="rounded-lg border border-white/10 px-3 py-1.5 text-slate-300 hover:bg-white/5">
                  MFA &amp; posture
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <div className="mb-4 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                <h2 className="text-sm font-semibold text-white">Watchdog alerts</h2>
              </div>
              {data.alerts.length === 0 ? (
                <p className="text-sm text-slate-400">No alerts — posture looks clean.</p>
              ) : (
                <ul className="space-y-2">
                  {data.alerts.map((a) => (
                    <li
                      key={a.id}
                      className={`rounded-xl border px-3 py-2.5 text-sm ${severityStyles(a.severity)}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium">{a.title}</p>
                        <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
                          {a.severity}
                        </span>
                      </div>
                      <p className="mt-1 text-xs opacity-80">{a.detail}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-sm font-semibold text-white">Config posture</h2>
            <p className="mt-1 text-xs text-slate-500">
              Runtime flags for this admin deployment (not a full SIEM — live Kleen watchdog).
            </p>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["Environment", data.posture.production ? "Production" : "Non-production"],
                ["Rate limiting", data.posture.rateLimitEnabled ? "On" : "Off"],
                ["Blocked hits (process)", String(data.posture.rateLimitBlockedHits)],
                ["Security headers", data.posture.securityHeadersEnabled ? "On" : "Off"],
                ["Preview gate", data.posture.siteAccessGateEnabled ? "On" : "Off"],
                ["Dev auth bypass", data.posture.devAuthBypassEnabled ? "ON — fix" : "Off"],
                ["Header email bypass", data.posture.headerEmailBypassEnabled ? "ON — fix" : "Off"],
                ["CRON_SECRET", data.posture.cronSecretConfigured ? "Set" : "Missing"],
                ["ADMIN_SECRET", data.posture.adminSecretConfigured ? "Set" : "Missing"],
                ["Auth", data.posture.authProvider],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3 border-b border-white/5 pb-2">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="font-medium text-white">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </>
      )}
    </div>
  );
}
