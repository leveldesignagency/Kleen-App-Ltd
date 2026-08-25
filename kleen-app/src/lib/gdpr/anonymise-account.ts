import type { SupabaseClient } from "@supabase/supabase-js";

/** Outward UK postcode sector only — enough for ops stats, not a full address. */
export function outwardPostcodeOnly(postcode: string | null | undefined): string {
  const raw = (postcode || "").trim().toUpperCase();
  if (!raw) return "XX";
  const parts = raw.split(/\s+/);
  if (parts.length >= 2) return parts[0];
  if (raw.length > 3) return raw.slice(0, raw.length - 3).trim() || "XX";
  return raw;
}

export type AnonymiseResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  jobsAnonymised?: number;
  paymentsUnlinked?: number;
};

/**
 * Scrub customer PII while retaining job/payment ledgers for tax, disputes, fraud.
 * Call BEFORE auth.admin.deleteUser. Respects active legal holds.
 */
export async function anonymiseCustomerAccountForDeletion(
  supabase: SupabaseClient,
  userId: string,
): Promise<AnonymiseResult> {
  const { data: holds } = await supabase
    .from("legal_holds")
    .select("id")
    .eq("subject_type", "user")
    .eq("subject_id", userId)
    .is("released_at", null)
    .limit(1);

  if (holds && holds.length > 0) {
    return { ok: false, skipped: true, reason: "active_legal_hold" };
  }

  const { data: heldJobs } = await supabase
    .from("jobs")
    .select("id")
    .eq("user_id", userId);

  const jobIds = (heldJobs || []).map((j) => j.id as string);
  if (jobIds.length > 0) {
    const { data: jobHolds } = await supabase
      .from("legal_holds")
      .select("id")
      .eq("subject_type", "job")
      .in("subject_id", jobIds)
      .is("released_at", null)
      .limit(1);
    if (jobHolds && jobHolds.length > 0) {
      return { ok: false, skipped: true, reason: "active_job_legal_hold" };
    }
  }

  const now = new Date().toISOString();
  const anonEmail = `deleted+${userId.replace(/-/g, "").slice(0, 16)}@anon.kleenapp.invalid`;

  // Addresses (cascade would delete them anyway — clear first for clarity)
  await supabase.from("addresses").delete().eq("user_id", userId);
  await supabase.from("payment_methods").delete().eq("user_id", userId);
  await supabase.from("notifications").delete().eq("user_id", userId);

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, postcode, address_line_1, notes")
    .eq("user_id", userId);

  let jobsAnonymised = 0;
  for (const job of jobs || []) {
    const outward = outwardPostcodeOnly(job.postcode);
    const { error } = await supabase
      .from("jobs")
      .update({
        address_line_1: "[redacted]",
        address_line_2: null,
        city: null,
        postcode: outward,
        notes: null,
        customer_anonymised_at: now,
        customer_display_label: "Deleted customer",
        // keep reference, amounts (via payments), stripe ids, status history
      })
      .eq("id", job.id);
    if (!error) jobsAnonymised += 1;
  }

  // Unlink payments but keep amounts + Stripe ids (tax / chargeback)
  const { data: pays } = await supabase.from("payments").select("id").eq("user_id", userId);
  let paymentsUnlinked = 0;
  if (pays?.length) {
    const { error } = await supabase
      .from("payments")
      .update({ user_id: null, payment_method_id: null })
      .eq("user_id", userId);
    if (!error) paymentsUnlinked = pays.length;
  }

  // Disputes: keep reason text for claims; unlink user
  await supabase.from("disputes").update({ user_id: null }).eq("user_id", userId);

  // Ratings
  await supabase
    .from("job_customer_ratings")
    .update({ customer_user_id: null })
    .eq("customer_user_id", userId);

  // If this user is also a contractor, set doc retention clock (do not wipe docs yet)
  const { data: operative } = await supabase
    .from("operatives")
    .select("id, documents_retain_until, documents_purged_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (operative?.id && !operative.documents_purged_at) {
    const retain = new Date();
    retain.setMonth(retain.getMonth() + 24);
    const retainUntil = retain.toISOString().slice(0, 10);
    await supabase
      .from("operatives")
      .update({
        user_id: null,
        email: `deleted-op+${String(operative.id).replace(/-/g, "").slice(0, 12)}@anon.kleenapp.invalid`,
        phone: null,
        documents_retain_until: operative.documents_retain_until || retainUntil,
        anonymised_at: now,
        is_active: false,
      })
      .eq("id", operative.id);
  }

  await supabase
    .from("profiles")
    .update({
      email: anonEmail,
      full_name: "Deleted user",
      phone: null,
      avatar_url: null,
      email_opt_in: false,
      sms_opt_in: false,
      push_opt_in: false,
      anonymised_at: now,
      anonymisation_note: "Account erased; ledgers retained in anonymised form",
      account_deletion_scheduled_at: null,
      account_deletion_requested_at: null,
      updated_at: now,
    })
    .eq("id", userId);

  return { ok: true, jobsAnonymised, paymentsUnlinked };
}

export async function userHasActiveLegalHold(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("legal_holds")
    .select("id")
    .eq("subject_type", "user")
    .eq("subject_id", userId)
    .is("released_at", null)
    .limit(1);
  return Boolean(data?.length);
}
