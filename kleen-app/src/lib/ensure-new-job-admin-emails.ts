import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getService } from "@/lib/services";
import { sendAdminNewJobEmail } from "@/lib/resend-admin-notify";
import { markAdminNewJobEmailSent } from "@/lib/mark-admin-new-job-email-sent";

export type EnsureNewJobEmailsResult = {
  checked: number;
  sent: number;
  errors: string[];
};

/**
 * Server backup: email admin for jobs where the customer notify never ran (e.g. stale session cookies).
 * Safe to call from cron or admin UI — skips jobs already marked sent.
 */
export async function ensureUnsentNewJobAdminEmails(limit = 25): Promise<EnsureNewJobEmailsResult> {
  const result: EnsureNewJobEmailsResult = { checked: 0, sent: 0, errors: [] };

  let admin;
  try {
    admin = createServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Service role unavailable";
    result.errors.push(msg);
    return result;
  }

  const { data: jobs, error } = await admin
    .from("jobs")
    .select("id, reference, postcode, preferred_date, service_id, user_id")
    .is("admin_new_job_email_sent_at", null)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    result.errors.push(error.message);
    return result;
  }
  if (!jobs?.length) return result;

  result.checked = jobs.length;
  const userIds = Array.from(new Set(jobs.map((j) => j.user_id).filter(Boolean))) as string[];
  const serviceIds = Array.from(new Set(jobs.map((j) => j.service_id).filter(Boolean))) as string[];

  const [profilesRes, servicesRes] = await Promise.all([
    admin.from("profiles").select("id, full_name, email").in("id", userIds),
    admin.from("services").select("id, name").in("id", serviceIds),
  ]);

  const profileById = new Map((profilesRes.data || []).map((p) => [p.id, p]));
  const serviceById = new Map((servicesRes.data || []).map((s) => [s.id, s.name]));

  for (const job of jobs) {
    const profile = profileById.get(job.user_id);
    const serviceName = serviceById.get(job.service_id) || getService(job.service_id)?.name || "Cleaning";
    const preferredDate =
      typeof job.preferred_date === "string"
        ? new Date(job.preferred_date).toLocaleDateString("en-GB", { dateStyle: "medium" })
        : String(job.preferred_date);

    const sendResult = await sendAdminNewJobEmail({
      jobId: job.id,
      jobReference: job.reference,
      serviceName,
      customerName: profile?.full_name?.trim() || "Customer",
      customerEmail: profile?.email || "",
      postcode: job.postcode || "—",
      preferredDate,
    });

    if (!sendResult.ok) {
      result.errors.push(`${job.reference}: ${sendResult.error || "Send failed"}`);
      continue;
    }

    await markAdminNewJobEmailSent(job.id);
    result.sent += 1;
  }

  return result;
}
