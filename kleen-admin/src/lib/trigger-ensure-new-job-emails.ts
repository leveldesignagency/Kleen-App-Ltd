/** Fire-and-forget: admin backup for missed customer new-job emails. */
export function triggerEnsureNewJobEmails(): void {
  fetch("/api/jobs/ensure-new-job-emails", {
    method: "POST",
    credentials: "include",
  }).catch(() => {});
}
