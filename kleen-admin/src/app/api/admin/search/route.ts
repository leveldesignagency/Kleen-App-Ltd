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
    admin
      .from("jobs")
      .select("id, reference, postcode, city, status")
      .or(`reference.ilike."${pattern}",postcode.ilike."${pattern}",city.ilike."${pattern}",address_line_1.ilike."${pattern}"`)
      .order("created_at", { ascending: false })
      .limit(LIMIT),
    admin
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "customer")
      .or(`email.ilike."${pattern}",full_name.ilike."${pattern}",phone.ilike."${pattern}"`)
      .order("created_at", { ascending: false })
      .limit(LIMIT),
    admin
      .from("operatives")
      .select("id, full_name, email, company_name, postcode")
      .or(`email.ilike."${pattern}",full_name.ilike."${pattern}",company_name.ilike."${pattern}",postcode.ilike."${pattern}"`)
      .order("created_at", { ascending: false })
      .limit(LIMIT),
    admin
      .from("disputes")
      .select("id, status, job_id, jobs!inner(reference, postcode)")
      .or(`jobs.reference.ilike."${pattern}",jobs.postcode.ilike."${pattern}"`)
      .limit(LIMIT),
  ]);

  for (const j of jobsRes.data || []) {
    results.push({
      id: j.id,
      type: "job",
      title: j.reference || j.id.slice(0, 8).toUpperCase(),
      subtitle: [j.postcode, j.city, j.status?.replace(/_/g, " ")].filter(Boolean).join(" · "),
      href: `/jobs/${j.id}`,
    });
  }

  for (const c of customersRes.data || []) {
    results.push({
      id: c.id,
      type: "customer",
      title: c.full_name?.trim() || c.email,
      subtitle: c.email,
      href: `/customers?highlight=${c.id}`,
    });
  }

  for (const o of contractorsRes.data || []) {
    results.push({
      id: o.id,
      type: "contractor",
      title: o.company_name?.trim() || o.full_name?.trim() || o.email,
      subtitle: [o.full_name, o.email, o.postcode].filter(Boolean).join(" · "),
      href: `/contractors/${o.id}`,
    });
  }

  for (const d of disputesRes.data || []) {
    const job = d.jobs as { reference?: string; postcode?: string } | { reference?: string; postcode?: string }[] | null;
    const j = Array.isArray(job) ? job[0] : job;
    results.push({
      id: d.id,
      type: "dispute",
      title: j?.reference ? `Dispute — ${j.reference}` : "Dispute",
      subtitle: [d.status?.replace(/_/g, " "), j?.postcode].filter(Boolean).join(" · "),
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
