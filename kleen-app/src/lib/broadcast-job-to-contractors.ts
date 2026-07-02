import type { SupabaseClient } from "@supabase/supabase-js";
import {
  distanceMiles,
  geocodeUkPostcode,
  postcodeMatchesServiceAreas,
} from "@/lib/postcode-distance";
import { sendContractorNewJobQuoteInviteEmail } from "@/lib/resend-contractor-quote-invite";

const QUOTE_DEADLINE_DAYS = 7;

type OperativeRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  service_areas: string[] | null;
  base_postcode: string | null;
  max_travel_radius_miles: number | null;
};

export type BroadcastJobResult = {
  ok: boolean;
  invitedCount: number;
  emailsSent: number;
  skippedAlreadyBroadcast: boolean;
  error?: string;
};

/**
 * Marketplace algorithm step 1–2:
 * After a customer submits a job, invite every verified contractor who offers
 * that service and is within their travel radius / service areas.
 */
export async function broadcastJobToMatchingContractors(
  admin: SupabaseClient,
  jobId: string,
): Promise<BroadcastJobResult> {
  const { data: job, error: jobErr } = await admin
    .from("jobs")
    .select("id, reference, service_id, postcode, preferred_date, status, marketplace_broadcast_at, services ( name )")
    .eq("id", jobId)
    .single();

  if (jobErr || !job) {
    return { ok: false, invitedCount: 0, emailsSent: 0, skippedAlreadyBroadcast: false, error: jobErr?.message || "Job not found" };
  }

  if (job.marketplace_broadcast_at) {
    return { ok: true, invitedCount: 0, emailsSent: 0, skippedAlreadyBroadcast: true };
  }

  const serviceId = job.service_id as string;
  const jobPostcode = String(job.postcode || "").trim();
  const jobCoords = jobPostcode ? await geocodeUkPostcode(jobPostcode) : null;

  const { data: operativeServices, error: osErr } = await admin
    .from("operative_services")
    .select("operative_id")
    .eq("service_id", serviceId)
    .eq("is_active", true);

  if (osErr) {
    return { ok: false, invitedCount: 0, emailsSent: 0, skippedAlreadyBroadcast: false, error: osErr.message };
  }

  const operativeIds = Array.from(new Set((operativeServices || []).map((r) => r.operative_id as string)));
  if (!operativeIds.length) {
    await admin
      .from("jobs")
      .update({ status: "awaiting_quotes", marketplace_broadcast_at: new Date().toISOString() })
      .eq("id", jobId)
      .in("status", ["pending"]);
    return { ok: true, invitedCount: 0, emailsSent: 0, skippedAlreadyBroadcast: false };
  }

  const { data: operatives, error: opErr } = await admin
    .from("operatives")
    .select("id, email, full_name, service_areas, base_postcode, max_travel_radius_miles")
    .in("id", operativeIds)
    .eq("is_verified", true)
    .eq("is_active", true);

  if (opErr) {
    return { ok: false, invitedCount: 0, emailsSent: 0, skippedAlreadyBroadcast: false, error: opErr.message };
  }

  const matching: OperativeRow[] = [];
  for (const op of (operatives || []) as OperativeRow[]) {
    const areas = Array.isArray(op.service_areas) ? op.service_areas : [];
    if (areas.length && !postcodeMatchesServiceAreas(jobPostcode, areas)) continue;

    const radius = op.max_travel_radius_miles ?? 25;
    const basePostcode = String(op.base_postcode || "").trim();
    if (jobCoords && basePostcode) {
      const baseCoords = await geocodeUkPostcode(basePostcode);
      if (baseCoords) {
        const miles = distanceMiles(baseCoords, jobCoords);
        if (miles > radius) continue;
      }
    }

    matching.push(op);
  }

  const { data: existing } = await admin
    .from("quote_requests")
    .select("operative_id")
    .eq("job_id", jobId);

  const alreadyInvited = new Set((existing || []).map((r) => r.operative_id as string));
  const toInvite = matching.filter((op) => !alreadyInvited.has(op.id));

  const deadline = new Date(Date.now() + QUOTE_DEADLINE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();
  let invitedCount = 0;
  let emailsSent = 0;

  const svc = job.services as { name?: string } | { name?: string }[] | null;
  const serviceName = Array.isArray(svc) ? svc[0]?.name : svc?.name;
  const reference = (job.reference as string) || jobId.slice(0, 8).toUpperCase();
  const preferredDate = String(job.preferred_date || "");

  for (const op of toInvite) {
    const { error: insertErr } = await admin.from("quote_requests").insert({
      job_id: jobId,
      operative_id: op.id,
      sent_by: null,
      initiated_by: "marketplace",
      status: "sent",
      deadline,
      message: "New customer job in your area — submit your quote in the contractor portal.",
      sent_at: now,
    });

    if (insertErr) {
      if (insertErr.code === "23505") continue;
      console.error("broadcast quote_request insert:", insertErr, { jobId, operativeId: op.id });
      continue;
    }

    invitedCount += 1;

    const email = op.email?.trim();
    if (email) {
      const sent = await sendContractorNewJobQuoteInviteEmail({
        toEmail: email,
        contractorName: op.full_name?.trim() || "there",
        jobReference: reference,
        jobId,
        serviceName: serviceName || "Cleaning",
        postcode: jobPostcode,
        preferredDate,
      });
      if (sent.ok) emailsSent += 1;
    }
  }

  await admin
    .from("jobs")
    .update({
      status: "awaiting_quotes",
      marketplace_broadcast_at: now,
    })
    .eq("id", jobId)
    .in("status", ["pending", "awaiting_quotes"]);

  return { ok: true, invitedCount, emailsSent, skippedAlreadyBroadcast: false };
}
