import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminJob } from "@/lib/admin-store";

type ProfileRow = { id: string; full_name?: string | null; email?: string | null; is_blocked?: boolean | null };
type DetailRow = { quantity?: number | null; complexity?: string | null };
type QuoteRow = { min_price_pence?: number | null; max_price_pence?: number | null; operatives_required?: number | null };

function mapToAdminJob(
  j: Record<string, unknown>,
  prof: ProfileRow | undefined,
  det: DetailRow | undefined,
  q: QuoteRow | undefined
): AdminJob {
  const services = j.services as { name?: string } | null | undefined;
  return {
    id: j.id as string,
    reference: (j.reference as string) || String(j.id).slice(0, 8).toUpperCase(),
    service: services?.name || "Cleaning",
    cleaning_type: (j.cleaning_type as string) || "domestic",
    status: j.status as string,
    user_id: j.user_id as string | undefined,
    customer_name: prof?.full_name || "Unknown",
    customer_email: prof?.email || "",
    address: [j.address_line_1, j.address_line_2, j.city].filter(Boolean).join(", "),
    postcode: (j.postcode as string) || "",
    date: (j.preferred_date as string) || (j.created_at as string),
    time: (j.preferred_time as string) || "",
    price_estimate:
      q != null && q.min_price_pence != null && q.max_price_pence != null
        ? Math.round((Number(q.min_price_pence) + Number(q.max_price_pence)) / 2)
        : 0,
    rooms: det?.quantity ?? 0,
    operatives: q?.operatives_required ?? 1,
    complexity: String(det?.complexity ?? "standard"),
    notes: (j.notes as string) || "",
    created_at: j.created_at as string,
    is_blocked: prof?.is_blocked ?? false,
    payment_captured_at: (j.payment_captured_at as string | null) ?? null,
    funds_released_at: (j.funds_released_at as string | null) ?? null,
    accepted_quote_request_id: (j.accepted_quote_request_id as string | null) ?? null,
    cancelled_reason: j.cancelled_reason as string | undefined,
  };
}

/**
 * Loads jobs for admin list/home without nested PostgREST embeds (avoids RLS infinite recursion on `jobs`).
 */
export async function fetchAdminJobsList(supabase: SupabaseClient): Promise<{ data: AdminJob[]; error: Error | null }> {
  const { data: jobs, error } = await supabase
    .from("jobs")
    .select("*, services(name)")
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: new Error(error.message) };
  if (!jobs?.length) return { data: [], error: null };

  const jobIds = jobs.map((j) => j.id as string);
  const userIds = Array.from(new Set(jobs.map((j) => j.user_id).filter(Boolean))) as string[];

  const [detailsRes, profilesRes, quotesRes] = await Promise.all([
    supabase.from("job_details").select("job_id, quantity, complexity").in("job_id", jobIds),
    supabase.from("profiles").select("id, full_name, email, is_blocked").in("id", userIds),
    supabase
      .from("quotes")
      .select("job_id, min_price_pence, max_price_pence, operatives_required, created_at")
      .in("job_id", jobIds)
      .order("created_at", { ascending: true }),
  ]);

  const profileById = new Map((profilesRes.data || []).map((p) => [p.id, p as ProfileRow]));
  const detailsByJob = new Map<string, DetailRow>();
  for (const row of detailsRes.data || []) {
    const jid = row.job_id as string;
    if (!detailsByJob.has(jid)) {
      detailsByJob.set(jid, { quantity: row.quantity as number | undefined, complexity: row.complexity as string | undefined });
    }
  }

  const quoteByJob = new Map<string, QuoteRow>();
  for (const row of quotesRes.data || []) {
    const jid = row.job_id as string;
    if (!quoteByJob.has(jid)) {
      quoteByJob.set(jid, {
        min_price_pence: row.min_price_pence as number,
        max_price_pence: row.max_price_pence as number,
        operatives_required: row.operatives_required as number | undefined,
      });
    }
  }

  const mapped: AdminJob[] = jobs.map((row) => {
    const jid = row.id as string;
    const prof = profileById.get(row.user_id as string);
    return mapToAdminJob(row as Record<string, unknown>, prof, detailsByJob.get(jid), quoteByJob.get(jid));
  });

  return { data: mapped, error: null };
}

/** Single job for admin detail / refresh — no nested embeds. */
export async function fetchAdminJobById(
  supabase: SupabaseClient,
  jobId: string
): Promise<{ data: AdminJob | null; error: Error | null }> {
  const { data: j, error } = await supabase.from("jobs").select("*, services(name)").eq("id", jobId).single();

  if (error) return { data: null, error: new Error(error.message) };
  if (!j) return { data: null, error: null };

  const uid = j.user_id as string;

  const [{ data: prof }, { data: jdRows }, { data: qRows }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, is_blocked").eq("id", uid).maybeSingle(),
    supabase.from("job_details").select("quantity, complexity").eq("job_id", jobId).limit(1),
    supabase
      .from("quotes")
      .select("min_price_pence, max_price_pence, operatives_required")
      .eq("job_id", jobId)
      .order("created_at", { ascending: true })
      .limit(1),
  ]);

  const det = jdRows?.[0];
  const q = qRows?.[0];
  return {
    data: mapToAdminJob(j as Record<string, unknown>, prof as ProfileRow | undefined, det, q),
    error: null,
  };
}
