import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { withSecureApiRoute } from "@/lib/security/with-secure-api-route";
import { DISPUTE_ELIGIBLE_JOB_STATUSES } from "@/lib/dispute-helpers";

async function listDisputesHandler() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createServiceRoleClient();

  const [{ data: rows, error }, { data: jobs }] = await Promise.all([
    admin
      .from("disputes")
      .select("id, job_id, status, reason, resolution, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    admin
      .from("jobs")
      .select("id, reference, service_id, status, preferred_date")
      .eq("user_id", user.id)
      .in("status", [...DISPUTE_ELIGIBLE_JOB_STATUSES])
      .order("preferred_date", { ascending: false }),
  ]);

  if (error) {
    console.error("disputes list:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const jobIds = Array.from(new Set((rows || []).map((r) => r.job_id)));
  const { data: jobRows } = jobIds.length
    ? await admin.from("jobs").select("id, reference, service_id").in("id", jobIds)
    : { data: [] as { id: string; reference: string; service_id: string }[] };

  const jobMap = new Map((jobRows || []).map((j) => [j.id, j]));

  const disputes = (rows || []).map((r) => {
    const job = jobMap.get(r.job_id);
    return {
      id: r.id,
      jobId: r.job_id,
      jobReference: job?.reference || r.job_id.slice(0, 8).toUpperCase(),
      serviceId: job?.service_id || "",
      status: r.status,
      reason: r.reason,
      resolution: r.resolution,
      createdAt: r.created_at,
    };
  });

  const openJobIds = new Set(
    disputes.filter((d) => !["resolved", "closed"].includes(d.status)).map((d) => d.jobId),
  );

  const eligibleJobs = ((jobs as { id: string; reference: string; service_id: string; status: string; preferred_date: string | null }[]) || []).filter(
    (j) => !openJobIds.has(j.id),
  );

  return NextResponse.json({ disputes, eligibleJobs });
}

export const GET = withSecureApiRoute("default", listDisputesHandler, { private: false });
