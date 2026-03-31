import type { SupabaseClient } from "@supabase/supabase-js";
import { getService } from "@/lib/services";

export type CustomerJobListRow = {
  id: string;
  reference: string;
  service_id: string;
  service_name: string;
  status: string;
  preferred_date: string;
  created_at: string;
  address_line_1?: string;
  postcode?: string;
  services?: { name?: string } | null;
};

/**
 * Customer jobs list: tries `services(name)` embed; on failure falls back to plain columns + getService().
 * Surfaces PostgREST errors when the embed breaks (RLS/schema) without silently showing an empty dashboard.
 */
export async function fetchCustomerJobsList(
  supabase: SupabaseClient,
  userId: string,
  options: { limit?: number; includeAddress?: boolean } = {}
): Promise<{ rows: CustomerJobListRow[]; error: { message: string; code?: string } | null }> {
  const limit = options.limit ?? 100;

  const withEmbed = options.includeAddress
    ? await supabase
        .from("jobs")
        .select(
          "id, reference, service_id, status, preferred_date, created_at, address_line_1, postcode, services(name)"
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit)
    : await supabase
        .from("jobs")
        .select("id, reference, service_id, status, preferred_date, created_at, services(name)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

  let raw: Record<string, unknown>[] | null;

  if (withEmbed.error) {
    const plain = options.includeAddress
      ? await supabase
          .from("jobs")
          .select("id, reference, service_id, status, preferred_date, created_at, address_line_1, postcode")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(limit)
      : await supabase
          .from("jobs")
          .select("id, reference, service_id, status, preferred_date, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(limit);
    if (plain.error) {
      return { rows: [], error: { message: plain.error.message, code: plain.error.code } };
    }
    raw = plain.data as Record<string, unknown>[] | null;
  } else {
    raw = withEmbed.data as Record<string, unknown>[] | null;
  }

  const rows: CustomerJobListRow[] = (raw || []).map((j) => {
    const serviceId = String(j.service_id ?? "");
    const embedded = j.services as { name?: string } | { name?: string }[] | null | undefined;
    const embName = Array.isArray(embedded) ? embedded[0]?.name : embedded?.name;
    const fromCatalog = getService(serviceId)?.name;
    return {
      id: String(j.id),
      reference: String(j.reference ?? ""),
      service_id: serviceId,
      service_name: embName || fromCatalog || "Cleaning",
      status: String(j.status ?? ""),
      preferred_date: String(j.preferred_date ?? ""),
      created_at: String(j.created_at ?? ""),
      address_line_1: j.address_line_1 != null ? String(j.address_line_1) : undefined,
      postcode: j.postcode != null ? String(j.postcode) : undefined,
    };
  });

  return { rows, error: null };
}

/** First quote row per job (by created_at desc) for price display — avoids PostgREST 500 from nested jobs→quotes RLS. */
export async function fetchQuotePricesByJobId(
  supabase: SupabaseClient,
  jobIds: string[]
): Promise<Map<string, { min: number; max: number }>> {
  const map = new Map<string, { min: number; max: number }>();
  if (jobIds.length === 0) return map;

  const { data: rows, error } = await supabase
    .from("quotes")
    .select("job_id, min_price_pence, max_price_pence, created_at")
    .in("job_id", jobIds)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("fetchQuotePricesByJobId:", error);
    return map;
  }

  for (const row of rows || []) {
    const jid = row.job_id as string;
    if (!map.has(jid)) {
      map.set(jid, {
        min: row.min_price_pence as number,
        max: row.max_price_pence as number,
      });
    }
  }
  return map;
}
