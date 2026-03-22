import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const ALLOWED_STATUSES = ["customer_accepted", "accepted", "awaiting_completion", "in_progress", "pending_confirmation"];

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token || token.length < 16) {
    return NextResponse.json({ error: "Invalid link" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { data: job, error } = await supabase
    .from("jobs")
    .select(
      "id, reference, status, service_id, operative_en_route_at, operative_arrived_at, operative_marked_complete_at, operative_marked_incomplete_at, operative_incomplete_reason"
    )
    .eq("operative_portal_token", token)
    .maybeSingle();

  if (error || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const j = job as {
    reference: string;
    status: string;
    service_id: string;
    operative_en_route_at: string | null;
    operative_arrived_at: string | null;
    operative_marked_complete_at: string | null;
    operative_marked_incomplete_at: string | null;
    operative_incomplete_reason: string | null;
  };

  const { data: svc } = await supabase.from("services").select("name").eq("id", j.service_id).maybeSingle();

  return NextResponse.json({
    reference: j.reference,
    status: j.status,
    serviceName: svc?.name || "Job",
    operative_en_route_at: j.operative_en_route_at,
    operative_arrived_at: j.operative_arrived_at,
    operative_marked_complete_at: j.operative_marked_complete_at,
    operative_marked_incomplete_at: j.operative_marked_incomplete_at,
    operative_incomplete_reason: j.operative_incomplete_reason,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token || token.length < 16) {
    return NextResponse.json({ error: "Invalid link" }, { status: 400 });
  }

  let body: { action?: string; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = body.action as "en_route" | "arrived" | "complete" | "incomplete" | undefined;
  if (!action || !["en_route", "arrived", "complete", "incomplete"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { data: job, error: jobErr } = await supabase
    .from("jobs")
    .select("id, status, operative_en_route_at, operative_arrived_at, operative_marked_complete_at, operative_marked_incomplete_at")
    .eq("operative_portal_token", token)
    .maybeSingle();

  if (jobErr || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const j = job as {
    id: string;
    status: string;
    operative_en_route_at: string | null;
    operative_arrived_at: string | null;
    operative_marked_complete_at: string | null;
    operative_marked_incomplete_at: string | null;
  };

  if (!ALLOWED_STATUSES.includes(j.status)) {
    return NextResponse.json({ error: "This job cannot be updated from the field portal right now." }, { status: 400 });
  }

  if (j.operative_marked_complete_at || j.operative_marked_incomplete_at) {
    return NextResponse.json({ error: "This job is already marked finished from the field portal." }, { status: 400 });
  }

  const now = new Date().toISOString();

  if (action === "en_route") {
    if (j.operative_en_route_at) {
      return NextResponse.json({ ok: true, idempotent: true });
    }
    await supabase
      .from("jobs")
      .update({
        operative_en_route_at: now,
        status: j.status === "customer_accepted" || j.status === "accepted" ? "awaiting_completion" : j.status,
      })
      .eq("id", j.id);
    return NextResponse.json({ ok: true });
  }

  if (action === "arrived") {
    if (!j.operative_en_route_at) {
      return NextResponse.json({ error: "Mark “On my way” first." }, { status: 400 });
    }
    if (j.operative_arrived_at) {
      return NextResponse.json({ ok: true, idempotent: true });
    }
    await supabase.from("jobs").update({ operative_arrived_at: now, status: "in_progress" }).eq("id", j.id);
    return NextResponse.json({ ok: true });
  }

  if (action === "complete") {
    if (!j.operative_arrived_at) {
      return NextResponse.json({ error: "Mark “Arrived” before completing." }, { status: 400 });
    }
    await supabase
      .from("jobs")
      .update({
        operative_marked_complete_at: now,
        contractor_confirmed_complete_at: now,
        status: "pending_confirmation",
      })
      .eq("id", j.id);
    return NextResponse.json({ ok: true });
  }

  if (action === "incomplete") {
    const reason = (body.reason || "").trim();
    if (reason.length < 3) {
      return NextResponse.json({ error: "Please give a short reason (at least 3 characters)." }, { status: 400 });
    }
    if (j.operative_marked_incomplete_at) {
      return NextResponse.json({ ok: true, idempotent: true });
    }
    await supabase
      .from("jobs")
      .update({
        operative_marked_incomplete_at: now,
        operative_incomplete_reason: reason,
        status: "disputed",
      })
      .eq("id", j.id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unsupported" }, { status: 400 });
}
