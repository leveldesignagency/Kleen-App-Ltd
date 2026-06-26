import { createServiceRoleClient } from "@/lib/supabase/service-role";

/** Mark admin new-job email as sent (idempotent). */
export async function markAdminNewJobEmailSent(jobId: string): Promise<void> {
  try {
    const admin = createServiceRoleClient();
    const { error } = await admin
      .from("jobs")
      .update({ admin_new_job_email_sent_at: new Date().toISOString() })
      .eq("id", jobId)
      .is("admin_new_job_email_sent_at", null);
    if (error) {
      console.error("markAdminNewJobEmailSent:", error.message, { jobId });
    }
  } catch (e) {
    console.error("markAdminNewJobEmailSent:", e);
  }
}
