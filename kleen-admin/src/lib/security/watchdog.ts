import type { SupabaseClient } from "@supabase/supabase-js";
import { buildSecuritySnapshot, type SecuritySnapshot } from "@/lib/security/snapshot";

export type SurfaceProbe = {
  id: string;
  label: string;
  url: string;
  ok: boolean;
  status: number | null;
  latencyMs: number | null;
  error: string | null;
  checkedAt: string;
};

export type DbHealth = {
  ok: boolean;
  latencyMs: number | null;
  error: string | null;
  counts: {
    profiles: number | null;
    jobs: number | null;
    operatives: number | null;
    payments: number | null;
    disputesOpen: number | null;
    legalHoldsActive: number | null;
    bansActive: number | null;
    admins: number | null;
    deletionScheduled: number | null;
  };
};

export type WatchdogAlert = {
  id: string;
  severity: "critical" | "warn" | "info";
  title: string;
  detail: string;
};

export type SecurityWatchdog = {
  generatedAt: string;
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  posture: SecuritySnapshot;
  database: DbHealth;
  surfaces: SurfaceProbe[];
  alerts: WatchdogAlert[];
  charts: {
    surfaceLatencyMs: { label: string; value: number }[];
    volumeBars: { label: string; value: number }[];
  };
};

function resolveSurfaces(): { id: string; label: string; url: string }[] {
  const marketing =
    process.env.MARKETING_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_MARKETING_URL?.trim() ||
    "https://kleenapp.co.uk";
  const admin = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://admin.kleenapp.co.uk";
  const dashboard =
    process.env.CUSTOMER_DASHBOARD_URL?.trim() ||
    process.env.NEXT_PUBLIC_CUSTOMER_DASHBOARD_URL?.trim() ||
    "https://dashboard.kleenapp.co.uk";
  const contractor =
    process.env.CONTRACTOR_PORTAL_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_CONTRACTOR_PORTAL_URL?.trim() ||
    "https://contractor.kleenapp.co.uk";

  return [
    { id: "marketing", label: "Marketing", url: marketing.replace(/\/$/, "") },
    { id: "admin", label: "Admin portal", url: `${admin.replace(/\/$/, "")}/login` },
    { id: "dashboard", label: "Customer dashboard", url: dashboard.replace(/\/$/, "") },
    { id: "contractor", label: "Contractor portal", url: contractor.replace(/\/$/, "") },
  ];
}

async function countRows(
  supabase: SupabaseClient,
  table: string,
  opts?: { eq?: [string, string]; isNull?: string; notNull?: string },
): Promise<number | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase.from(table).select("*", { count: "exact", head: true });
    if (opts?.eq) q = q.eq(opts.eq[0], opts.eq[1]);
    if (opts?.isNull) q = q.is(opts.isNull, null);
    if (opts?.notNull) q = q.not(opts.notNull, "is", null);
    const { count, error } = await q;
    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
}

export async function probeSurface(
  id: string,
  label: string,
  url: string,
  timeoutMs = 8000,
): Promise<SurfaceProbe> {
  const checkedAt = new Date().toISOString();
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "Kleen-Security-Watchdog/1.0" },
      cache: "no-store",
    });
    const latencyMs = Date.now() - started;
    const ok = res.status > 0 && res.status < 500;
    return {
      id,
      label,
      url,
      ok,
      status: res.status,
      latencyMs,
      error: ok ? null : `HTTP ${res.status}`,
      checkedAt,
    };
  } catch (e) {
    return {
      id,
      label,
      url,
      ok: false,
      status: null,
      latencyMs: Date.now() - started,
      error: e instanceof Error ? e.message : "Probe failed",
      checkedAt,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function checkDatabaseHealth(supabase: SupabaseClient): Promise<DbHealth> {
  const started = Date.now();
  try {
    const ping = await supabase.from("profiles").select("id", { head: true, count: "exact" }).limit(1);
    if (ping.error) {
      return emptyDbHealth(false, Date.now() - started, ping.error.message);
    }

    let disputesOpen: number | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count, error } = await (supabase.from("disputes") as any)
        .select("*", { count: "exact", head: true })
        .not("status", "in", "(resolved,closed,cancelled)");
      disputesOpen = error ? null : count ?? 0;
    } catch {
      disputesOpen = null;
    }

    const [
      profiles,
      jobs,
      operatives,
      payments,
      legalHoldsActive,
      bansActive,
      admins,
      deletionScheduled,
    ] = await Promise.all([
      countRows(supabase, "profiles"),
      countRows(supabase, "jobs"),
      countRows(supabase, "operatives"),
      countRows(supabase, "payments"),
      countRows(supabase, "legal_holds", { isNull: "released_at" }),
      countRows(supabase, "account_bans", { isNull: "lifted_at" }),
      countRows(supabase, "profiles", { eq: ["role", "admin"] }),
      countRows(supabase, "profiles", { notNull: "account_deletion_scheduled_at" }),
    ]);

    return {
      ok: true,
      latencyMs: Date.now() - started,
      error: null,
      counts: {
        profiles,
        jobs,
        operatives,
        payments,
        disputesOpen,
        legalHoldsActive,
        bansActive,
        admins,
        deletionScheduled,
      },
    };
  } catch (e) {
    return emptyDbHealth(
      false,
      Date.now() - started,
      e instanceof Error ? e.message : "Database check failed",
    );
  }
}

function emptyDbHealth(ok: boolean, latencyMs: number, error: string | null): DbHealth {
  return {
    ok,
    latencyMs,
    error,
    counts: {
      profiles: null,
      jobs: null,
      operatives: null,
      payments: null,
      disputesOpen: null,
      legalHoldsActive: null,
      bansActive: null,
      admins: null,
      deletionScheduled: null,
    },
  };
}

function scoreWatchdog(
  posture: SecuritySnapshot,
  database: DbHealth,
  surfaces: SurfaceProbe[],
): { score: number; grade: SecurityWatchdog["grade"]; alerts: WatchdogAlert[] } {
  const alerts: WatchdogAlert[] = [];
  let score = 100;

  if (!database.ok) {
    score -= 40;
    alerts.push({
      id: "db-down",
      severity: "critical",
      title: "Database unreachable",
      detail: database.error || "Health query failed",
    });
  } else if ((database.latencyMs || 0) > 2000) {
    score -= 10;
    alerts.push({
      id: "db-slow",
      severity: "warn",
      title: "Database latency high",
      detail: `${database.latencyMs}ms for health query`,
    });
  }

  for (const s of surfaces) {
    if (!s.ok) {
      score -= 15;
      alerts.push({
        id: `surface-${s.id}`,
        severity: "critical",
        title: `${s.label} unreachable`,
        detail: s.error || `Failed probe for ${s.url}`,
      });
    } else if ((s.latencyMs || 0) > 2500) {
      score -= 5;
      alerts.push({
        id: `latency-${s.id}`,
        severity: "warn",
        title: `${s.label} slow`,
        detail: `${s.latencyMs}ms response time`,
      });
    }
  }

  if (posture.devAuthBypassEnabled) {
    score -= 25;
    alerts.push({
      id: "dev-bypass",
      severity: "critical",
      title: "Dev auth bypass enabled",
      detail: "Disable bypass flags in production immediately.",
    });
  }
  if (posture.headerEmailBypassEnabled) {
    score -= 20;
    alerts.push({
      id: "header-bypass",
      severity: "critical",
      title: "Header email bypass enabled",
      detail: "X-User-Email bypass must be off in production.",
    });
  }
  if (posture.production && posture.siteAccessGateEnabled) {
    score -= 5;
    alerts.push({
      id: "preview-gate",
      severity: "warn",
      title: "Preview gate still on",
      detail: "Site access gate is enabled in production.",
    });
  }
  if (!posture.cronSecretConfigured) {
    score -= 8;
    alerts.push({
      id: "cron-secret",
      severity: "warn",
      title: "CRON_SECRET missing",
      detail: "Scheduled GDPR purge / jobs will reject until configured.",
    });
  }

  for (const note of posture.notes) {
    if (alerts.some((a) => a.detail === note)) continue;
    alerts.push({
      id: `note-${alerts.length}`,
      severity: /WARNING/i.test(note) ? "critical" : "info",
      title: "Posture note",
      detail: note,
    });
  }

  score = Math.max(0, Math.min(100, score));
  const grade: SecurityWatchdog["grade"] =
    score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "F";

  return { score, grade, alerts };
}

export async function buildSecurityWatchdog(supabase: SupabaseClient): Promise<SecurityWatchdog> {
  const posture = buildSecuritySnapshot();
  const surfacesSpec = resolveSurfaces();

  const [database, ...surfaces] = await Promise.all([
    checkDatabaseHealth(supabase),
    ...surfacesSpec.map((s) => probeSurface(s.id, s.label, s.url)),
  ]);

  const { score, grade, alerts } = scoreWatchdog(posture, database, surfaces);

  const c = database.counts;
  return {
    generatedAt: new Date().toISOString(),
    score,
    grade,
    posture,
    database,
    surfaces,
    alerts,
    charts: {
      surfaceLatencyMs: surfaces.map((s) => ({ label: s.label, value: s.latencyMs ?? 0 })),
      volumeBars: [
        { label: "Profiles", value: c.profiles ?? 0 },
        { label: "Jobs", value: c.jobs ?? 0 },
        { label: "Contractors", value: c.operatives ?? 0 },
        { label: "Payments", value: c.payments ?? 0 },
        { label: "Open disputes", value: c.disputesOpen ?? 0 },
        { label: "Active holds", value: c.legalHoldsActive ?? 0 },
      ],
    },
  };
}
