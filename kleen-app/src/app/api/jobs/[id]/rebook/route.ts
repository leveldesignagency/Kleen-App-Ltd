import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendContractorJobRebookedEmail } from "@/lib/resend-contractor-notify";

/**
 * Customer rebooks the same contractor after a could-not-start visit.
 * Keeps assignment + payment; resets field timestamps; sets a new preferred date/time.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: jobId } = await params;
  if (!jobId) {
    return NextResponse.json({ error: "Missing job id" }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { preferredDate?: string; preferredTime?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const preferredDate = (body.preferredDate || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(preferredDate)) {
    return NextResponse.json({ error: "Choose a valid date (YYYY-MM-DD)." }, { status: 400 });
  }

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  if (preferredDate < todayKey) {
    return NextResponse.json({ error: "Date must be today or later." }, { status: 400 });
  }

  let preferredTime: string | null = null;
  if (body.preferredTime != null && String(body.preferredTime).trim()) {
    const t = String(body.preferredTime).trim();
    if (!/^\d{2}:\d{2}(:\d{2})?$/.test(t)) {
      return NextResponse.json({ error: "Invalid time." }, { status: 400 });
    }
    preferredTime = t.length === 5 ? `${t}:00` : t;
  }

  const admin = createServiceRoleClient();
  const { data: job, error: jobErr } = await admin
    .from("jobs")
    .select(
      "id, reference, user_id, status, operative_marked_incomplete_at, accepted_quote_request_id",
    )
    .eq("id", jobId)
    .maybeSingle();

  if (jobErr || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  if (job.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rebookable =
    job.status === "could_not_start" ||
    (job.status === "disputed" && !!job.operative_marked_incomplete_at);
  if (!rebookable) {
    return NextResponse.json(
      { error: "This job isn’t waiting for a rebook." },
      { status: 400 },
    );
  }

  const { data: assignment } = await admin
    .from("job_assignments")
    .select("id, operative_id, operatives ( id, full_name, user_id, email )")
    .eq("job_id", jobId)
    .limit(1)
    .maybeSingle();

  if (!assignment?.operative_id) {
    return NextResponse.json(
      { error: "No contractor is assigned to rebook with." },
      { status: 400 },
    );
  }

  const { error: updErr } = await admin
    .from("jobs")
    .update({
      preferred_date: preferredDate,
      preferred_time: preferredTime,
      status: "awaiting_completion",
      operative_en_route_at: null,
      operative_arrived_at: null,
      actual_start: null,
      operative_marked_incomplete_at: null,
      operative_incomplete_reason: null,
      cannot_start_reason_code: null,
      operative_marked_complete_at: null,
      contractor_confirmed_complete_at: null,
      customer_confirmed_complete_at: null,
    })
    .eq("id", jobId);

  if (updErr) {
    console.error("rebook update:", updErr);
    return NextResponse.json(
      {
        error: updErr.message.includes("could_not_start")
          ? "Database needs migration 058 (could_not_start status)."
          : updErr.message,
      },
      { status: 400 },
    );
  }

  const op = Array.isArray(assignment.operatives)
    ? assignment.operatives[0]
    : assignment.operatives;
  const opEmail =
    (op as { email?: string | null } | null)?.email ||
    (await (async () => {
      const uid = (op as { user_id?: string | null } | null)?.user_id;
      if (!uid) return null;
      const { data: authUser } = await admin.auth.admin.getUserById(uid);
      return authUser.user?.email ?? null;
    })());

  if (opEmail) {
    void sendContractorJobRebookedEmail({
      toEmail: opEmail,
      contractorName: (op as { full_name?: string | null } | null)?.full_name || "Contractor",
      jobReference: job.reference,
      jobId,
      preferredDate,
      preferredTime,
    }).catch((e) => console.error("sendContractorJobRebookedEmail:", e));
  }

  return NextResponse.json({
    ok: true,
    preferred_date: preferredDate,
    preferred_time: preferredTime,
    status: "awaiting_completion",
  });
}
