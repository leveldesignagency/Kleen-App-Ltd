import type { SupabaseClient } from "@supabase/supabase-js";
import type { Contractor } from "@/lib/admin-store";

type OperativeRow = Record<string, unknown>;
type OperativeServiceRow = {
  operative_id: string;
  service_id: string;
  is_active?: boolean | null;
  services?: { name?: string } | { name?: string }[] | null;
};

function mapOperativeRow(c: OperativeRow): Contractor {
  return {
    id: c.id as string,
    user_id: c.user_id as string | undefined,
    full_name: (c.full_name as string) || "",
    email: (c.email as string) || "",
    phone: (c.phone as string) || "",
    contractor_type: (c.contractor_type as Contractor["contractor_type"]) || "sole_trader",
    company_name: (c.company_name as string) || "",
    specialisations: (c.specialisations as string[]) || [],
    service_areas: (c.service_areas as string[]) || [],
    rating: (c.avg_rating as number) || 0,
    total_jobs: (c.total_jobs as number) || 0,
    hourly_rate: c.hourly_rate as number | undefined,
    is_active: (c.is_active as boolean) ?? true,
    is_verified: (c.is_verified as boolean) ?? false,
    notes: (c.notes as string) || "",
    bank_account_name: (c.bank_account_name as string) || "",
    bank_sort_code: (c.bank_sort_code as string) || "",
    bank_account_number: (c.bank_account_number as string) || "",
    company_number: (c.company_number as string) || "",
    vat_number: (c.vat_number as string) || "",
    utr_number: (c.utr_number as string) || "",
    stripe_account_id: (c.stripe_account_id as string) || "",
    created_at: c.created_at as string,
    rejected_at: (c.rejected_at as string | null) ?? null,
    rejection_message: (c.rejection_message as string | null) ?? null,
    verified_at: (c.verified_at as string | null) ?? null,
    submitted_for_review_at: (c.submitted_for_review_at as string | null) ?? null,
    trading_name: (c.trading_name as string) || "",
    registered_address: (c.registered_address as string) || "",
    linked_service_names: [],
    linked_service_ids: [],
  };
}

/** Loads contractors with services from operative_services (driver portal + admin edit). */
export async function fetchAdminContractors(
  supabase: SupabaseClient,
): Promise<{ data: Contractor[]; error: Error | null }> {
  const { data: ops, error } = await supabase
    .from("operatives")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: new Error(error.message) };
  if (!ops?.length) return { data: [], error: null };

  const operativeIds = ops.map((o) => o.id as string);
  const { data: osRows } = await supabase
    .from("operative_services")
    .select("operative_id, service_id, is_active, services(name)")
    .in("operative_id", operativeIds)
    .eq("is_active", true);

  const byOperative = new Map<string, { names: string[]; ids: string[] }>();
  for (const row of (osRows || []) as OperativeServiceRow[]) {
    const svc = Array.isArray(row.services) ? row.services[0] : row.services;
    const name = svc?.name?.trim();
    if (!name) continue;
    const entry = byOperative.get(row.operative_id) || { names: [], ids: [] };
    if (!entry.ids.includes(row.service_id)) {
      entry.ids.push(row.service_id);
      entry.names.push(name);
    }
    byOperative.set(row.operative_id, entry);
  }

  const contractors = ops.map((c) => {
    const mapped = mapOperativeRow(c as OperativeRow);
    const linked = byOperative.get(mapped.id);
    return {
      ...mapped,
      linked_service_names: linked?.names ?? [],
      linked_service_ids: linked?.ids ?? [],
    };
  });

  return { data: contractors, error: null };
}

export function contractorServiceTags(c: Contractor): string[] {
  const fromCatalogue = c.linked_service_names || [];
  const legacy = c.specialisations || [];
  const merged: string[] = [];
  for (const name of [...fromCatalogue, ...legacy]) {
    const n = name?.trim();
    if (n && !merged.some((x) => x.toLowerCase() === n.toLowerCase())) merged.push(n);
  }
  return merged;
}

export function contractorOffersService(c: Contractor, serviceId: string | null | undefined, serviceName?: string): boolean {
  if (serviceId && c.linked_service_ids?.includes(serviceId)) return true;
  if (!serviceName?.trim()) return false;
  const q = serviceName.trim().toLowerCase();
  return contractorServiceTags(c).some((t) => t.toLowerCase() === q || t.toLowerCase().includes(q));
}
