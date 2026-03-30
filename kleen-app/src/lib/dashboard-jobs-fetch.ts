import type { SupabaseClient } from "@supabase/supabase-js";

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
