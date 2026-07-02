import type { SupabaseClient } from "@supabase/supabase-js";
import { getService } from "@/lib/services";
import { sendAdminNewJobEmail, type AdminEmailResult } from "@/lib/resend-admin-notify";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/** Load job + customer context and send admin new-job email. */
export async function notifyAdminNewJobEmail(
  supabase: SupabaseClient,
  params: { jobId: string; userId: string; userEmail?: string | null },
): Promise<AdminEmailResult> {
  let job: {
    id: string;
    reference: string;
    postcode: string | null;
    preferred_date: string;
    service_id: string;
    user_id: string;
  } | null = null;
  let jobErr: { message: string } | null = null;

  try {
    const admin = createServiceRoleClient();
    const { data, error } = await admin
      .from("jobs")
      .select("id, reference, postcode, preferred_date, service_id, user_id")
      .eq("id", params.jobId)
      .maybeSingle();
    if (error) jobErr = error;
    else if (!data || data.user_id !== params.userId) {
      jobErr = { message: "Job not found for this user" };
    } else {
      job = data;
    }
  } catch {
    const { data, error } = await supabase
      .from("jobs")
      .select("id, reference, postcode, preferred_date, service_id, user_id")
      .eq("id", params.jobId)
      .eq("user_id", params.userId)
      .single();
    if (error || !data) jobErr = error || { message: "Job not found" };
    else job = data;
  }

  if (jobErr || !job) {
    return { ok: false, error: jobErr?.message || "Job not found" };
  }

  const db = (() => {
    try {
      return createServiceRoleClient();
    } catch {
      return supabase;
    }
  })();

  const { data: profile } = await db
    .from("profiles")
    .select("full_name, email")
    .eq("id", params.userId)
    .maybeSingle();

  const { data: svc } = await db
    .from("services")
    .select("name")
    .eq("id", job.service_id)
    .maybeSingle();

  const serviceName = svc?.name || getService(job.service_id)?.name || "Cleaning";
  const customerName = profile?.full_name?.trim() || "Customer";
  const customerEmail = profile?.email || params.userEmail || "";
  const preferredDate =
    typeof job.preferred_date === "string"
      ? new Date(job.preferred_date).toLocaleDateString("en-GB", { dateStyle: "medium" })
      : String(job.preferred_date);

  return sendAdminNewJobEmail({
    jobId: job.id,
    jobReference: job.reference,
    serviceName,
    customerName,
    customerEmail,
    postcode: job.postcode || "—",
    preferredDate,
  });
}
