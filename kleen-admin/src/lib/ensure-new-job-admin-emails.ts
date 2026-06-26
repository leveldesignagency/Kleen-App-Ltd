import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendAdminNewJobEmail } from "@/lib/resend-admin-new-job";

export type EnsureNewJobEmailsResult = {
  checked: number;
  sent: number;
  errors: string[];
};

async function markAdminNewJobEmailSent(jobId: string): Promise<void> {
  const admin = createServiceRoleClient();
  const { error } = await admin
    .from("jobs")
    .update({ admin_new_job_email_sent_at: new Date().toISOString() })
    .eq("id", jobId)
    .is("admin_new_job_email_sent_at", null);
  if (error) {
    console.error("markAdminNewJobEmailSent:", error.message, { jobId });
  }
}

/** Admin backup: send new-job emails when customer notify failed (e.g. stale cookies). */
export async function ensureUnsentNewJobAdminEmails(limit = 25): Promise<EnsureNewJobEmailsResult> {
  const result: EnsureNewJobEmailsResult = { checked: 0, sent: 0, errors: [] };

  let admin;
  try {
    admin = createServiceRoleClient();
  } catch (e) {
    result.errors.push(e instanceof Error ? e.message : "Service role unavailable");
    return result;
  }

  const { data: jobs, error } = await admin
    .from("jobs")
    .select("id, reference, postcode, preferred_date, service_id, user_id, services(name)")
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
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name, email")
    .in("id", userIds);
  const profileById = new Map((profiles || []).map((p) => [p.id, p]));

  for (const job of jobs) {
    const profile = profileById.get(job.user_id);
    const services = job.services as { name?: string } | null | undefined;
    const preferredDate =
      typeof job.preferred_date === "string"
        ? new Date(job.preferred_date).toLocaleDateString("en-GB", { dateStyle: "medium" })
        : String(job.preferred_date);

    const sendResult = await sendAdminNewJobEmail({
      jobId: job.id,
      jobReference: job.reference,
      serviceName: services?.name || "Cleaning",
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
