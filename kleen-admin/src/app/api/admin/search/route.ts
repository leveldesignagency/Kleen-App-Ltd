import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAdminApi } from "@/lib/require-admin-api";

export type SearchResultItem = {
  id: string;
  type: "job" | "customer" | "contractor" | "dispute";
  title: string;
  subtitle: string;
  href: string;
};

const LIMIT = 6;

/** Global admin search across jobs, customers, contractors, disputes. */
export async function GET(request: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const q = request.nextUrl.searchParams.get("q")?.trim() || "";
  const typesParam = request.nextUrl.searchParams.get("types")?.trim() || "";
  const typeFilter = new Set(
    typesParam
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
  );
  const want = (t: SearchResultItem["type"]) => typeFilter.size === 0 || typeFilter.has(t);

  const safe = q.replace(/[%_,()\\]/g, " ").trim();
  if (safe.length < 2) {
    return NextResponse.json({ results: [] as SearchResultItem[] });
  }

  const pattern = `%${safe}%`;

  let admin;
  try {
    admin = createServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server misconfigured";
    return NextResponse.json({ error: msg }, { status: 503 });
  }
  const results: SearchResultItem[] = [];

  const [jobsRes, customersRes, contractorsRes, disputesRes] = await Promise.all([
    want("job")
      ? admin
          .from("jobs")
          .select("id, reference, postcode, city, status, address_line_1")
          .or(
            `reference.ilike."${pattern}",postcode.ilike."${pattern}",city.ilike."${pattern}",address_line_1.ilike."${pattern}"`,
          )
          .order("created_at", { ascending: false })
          .limit(LIMIT)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    want("customer")
      ? admin
          .from("profiles")
          .select("id, full_name, email, phone")
          .eq("role", "customer")
          .or(`email.ilike."${pattern}",full_name.ilike."${pattern}",phone.ilike."${pattern}"`)
          .order("created_at", { ascending: false })
          .limit(LIMIT)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    want("contractor")
      ? admin
          .from("operatives")
          .select("id, full_name, email, company_name, trading_name, postcode, registered_address")
          .or(
            `email.ilike."${pattern}",full_name.ilike."${pattern}",company_name.ilike."${pattern}",trading_name.ilike."${pattern}",postcode.ilike."${pattern}",registered_address.ilike."${pattern}"`,
          )
          .order("created_at", { ascending: false })
          .limit(LIMIT)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    want("dispute")
      ? admin
          .from("disputes")
          .select("id, status, job_id, jobs!inner(reference, postcode)")
          .or(`jobs.reference.ilike."${pattern}",jobs.postcode.ilike."${pattern}"`)
          .limit(LIMIT)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
  ]);

  for (const row of jobsRes.data || []) {
    const j = row as {
      id: string;
      reference?: string;
      postcode?: string;
      city?: string;
      status?: string;
      address_line_1?: string;
    };
    results.push({
      id: j.id,
      type: "job",
      title: j.reference || j.id.slice(0, 8).toUpperCase(),
      subtitle: [j.address_line_1, j.postcode, j.city, j.status?.replace(/_/g, " ")]
        .filter(Boolean)
        .join(" · "),
      href: `/jobs/${j.id}`,
    });
  }

  for (const row of customersRes.data || []) {
    const c = row as { id: string; full_name?: string; email?: string; phone?: string };
    results.push({
      id: c.id,
      type: "customer",
      title: c.full_name?.trim() || c.email || "Customer",
      subtitle: [c.email, c.phone].filter(Boolean).join(" · "),
      href: `/customers?highlight=${c.id}`,
    });
  }

  for (const row of contractorsRes.data || []) {
    const o = row as {
      id: string;
      full_name?: string;
      email?: string;
      company_name?: string;
      trading_name?: string;
      postcode?: string;
      registered_address?: string;
    };
    results.push({
      id: o.id,
      type: "contractor",
      title: o.company_name?.trim() || o.trading_name?.trim() || o.full_name?.trim() || o.email || "Contractor",
      subtitle: [o.full_name, o.email, o.registered_address || o.postcode].filter(Boolean).join(" · "),
      href: `/contractors/${o.id}`,
    });
  }

  for (const row of disputesRes.data || []) {
    const d = row as {
      id: string;
      status?: string;
      jobs?: { reference?: string; postcode?: string } | { reference?: string; postcode?: string }[] | null;
    };
    const job = Array.isArray(d.jobs) ? d.jobs[0] : d.jobs;
    results.push({
      id: d.id,
      type: "dispute",
      title: job?.reference ? `Dispute — ${job.reference}` : "Dispute",
      subtitle: [d.status?.replace(/_/g, " "), job?.postcode].filter(Boolean).join(" · "),
      href: `/disputes`,
    });
  }

  const typeOrder: Record<SearchResultItem["type"], number> = {
    job: 0,
    customer: 1,
    contractor: 2,
    dispute: 3,
  };
  results.sort((a, b) => typeOrder[a.type] - typeOrder[b.type]);

  return NextResponse.json({ results: results.slice(0, 20) });
}
