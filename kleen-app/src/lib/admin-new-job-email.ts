import type { SupabaseClient } from "@supabase/supabase-js";
import { getService } from "@/lib/services";
import { sendAdminNewJobEmail, type AdminEmailResult } from "@/lib/resend-admin-notify";

/** Load job + customer context and send admin new-job email. Uses session client only (no service role). */
export async function notifyAdminNewJobEmail(
  supabase: SupabaseClient,
  params: { jobId: string; userId: string; userEmail?: string | null },
): Promise<AdminEmailResult> {
  const { data: job, error: jobErr } = await supabase
    .from("jobs")
    .select("id, reference, postcode, preferred_date, service_id")
    .eq("id", params.jobId)
    .eq("user_id", params.userId)
    .single();

  if (jobErr || !job) {
    return { ok: false, error: jobErr?.message || "Job not found" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", params.userId)
    .maybeSingle();

  const { data: svc } = await supabase
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
