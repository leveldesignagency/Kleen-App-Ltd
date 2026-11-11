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
 * True if erase/purge must pause for this auth user:
 * - direct user hold
 * - hold on any job they own
 * - hold on a linked contractor (operative) record
 */
export async function userHasActiveLegalHold(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data: userHolds } = await supabase
    .from("legal_holds")
    .select("id")
    .eq("subject_type", "user")
    .eq("subject_id", userId)
    .is("released_at", null)
    .limit(1);
  if (userHolds?.length) return true;

  const { data: jobs } = await supabase.from("jobs").select("id").eq("user_id", userId);
  const jobIds = (jobs || []).map((j) => j.id as string);
  if (jobIds.length > 0) {
    const { data: jobHolds } = await supabase
      .from("legal_holds")
      .select("id")
      .eq("subject_type", "job")
      .in("subject_id", jobIds)
      .is("released_at", null)
      .limit(1);
    if (jobHolds?.length) return true;
  }

  const { data: operatives } = await supabase
    .from("operatives")
    .select("id")
    .eq("user_id", userId);
  const opIds = (operatives || []).map((o) => o.id as string);
  if (opIds.length > 0) {
    const { data: opHolds } = await supabase
      .from("legal_holds")
      .select("id")
      .eq("subject_type", "operative")
      .in("subject_id", opIds)
      .is("released_at", null)
      .limit(1);
    if (opHolds?.length) return true;
  }

  return false;
}

/**
 * Scrub customer (+ linked contractor) PII while retaining job/payment ledgers
 * for tax, disputes, and fraud. Call BEFORE auth.admin.deleteUser.
 * Respects active legal holds on user, jobs, or linked operatives.
 */
export async function anonymiseCustomerAccountForDeletion(
  supabase: SupabaseClient,
  userId: string,
): Promise<AnonymiseResult> {
  if (await userHasActiveLegalHold(supabase, userId)) {
    return { ok: false, skipped: true, reason: "active_legal_hold" };
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

  // Linked contractor: scrub contact PII, start 24-month ID doc clock (do not wipe docs yet)
  const { data: operatives } = await supabase
    .from("operatives")
    .select("id, documents_retain_until, documents_purged_at, anonymised_at")
    .eq("user_id", userId);

  for (const operative of operatives || []) {
    if (operative.anonymised_at) continue;
    const retain = new Date();
    retain.setMonth(retain.getMonth() + 24);
    const retainUntil = retain.toISOString().slice(0, 10);
    const opUpdate: Record<string, unknown> = {
      // user_id cleared; left_at + anonymised_at block resurrection on next login
      user_id: null,
      email: `deleted-op+${String(operative.id).replace(/-/g, "").slice(0, 12)}@anon.kleenapp.invalid`,
      full_name: "Deleted contractor",
      phone: null,
      company_name: null,
      company_number: null,
      vat_number: null,
      notes: null,
      trading_name: null,
      registered_address: null,
      documents_retain_until: operative.documents_retain_until || retainUntil,
      anonymised_at: now,
      is_active: false,
      left_at: now,
    };
    let { error: opErr } = await supabase.from("operatives").update(opUpdate).eq("id", operative.id);
    // Older DBs may lack UK onboarding columns — retry without them.
    if (opErr && /trading_name|registered_address|left_at|does not exist|schema cache/i.test(opErr.message)) {
      delete opUpdate.trading_name;
      delete opUpdate.registered_address;
      if (/left_at/i.test(opErr.message)) delete opUpdate.left_at;
      ({ error: opErr } = await supabase.from("operatives").update(opUpdate).eq("id", operative.id));
    }
    if (opErr) {
      console.error(`anonymise operative ${operative.id}:`, opErr.message);
    }
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
