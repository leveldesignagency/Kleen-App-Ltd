import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/require-admin-api";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/** List all disputes for admin mediation UI (bypasses client RLS/embed 500s). */
export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const admin = createServiceRoleClient();
  const { data: rows, error } = await admin
    .from("disputes")
    .select("id, job_id, user_id, status, reason, resolution, created_at, resolved_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("admin disputes list:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const jobIds = Array.from(new Set((rows || []).map((r) => r.job_id)));
  const { data: jobs } = jobIds.length
    ? await admin.from("jobs").select("id, reference, status").in("id", jobIds)
    : { data: [] as { id: string; reference: string; status: string }[] };

  const jobMap = new Map((jobs || []).map((j) => [j.id, j]));

  const disputes = (rows || []).map((r) => {
    const job = jobMap.get(r.job_id);
    return {
      id: r.id,
      job_id: r.job_id,
      user_id: r.user_id,
      status: r.status,
      reason: r.reason,
      resolution: r.resolution,
      created_at: r.created_at,
      resolved_at: r.resolved_at,
      jobs: job
        ? { reference: job.reference, status: job.status }
        : { reference: r.job_id.slice(0, 8).toUpperCase(), status: "" },
    };
  });

  return NextResponse.json({ disputes });
}
