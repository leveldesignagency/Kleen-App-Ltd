import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { runContractorFieldAction, type FieldActionName } from "@/lib/contractor-field-job";

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

  const action = body.action as FieldActionName | undefined;
  if (!action || !["en_route", "arrived", "complete", "incomplete"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { data: jobRow, error: jobErr } = await supabase
    .from("jobs")
    .select("id")
    .eq("operative_portal_token", token)
    .maybeSingle();

  if (jobErr || !jobRow) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const result = await runContractorFieldAction(supabase, jobRow.id, action, {
    incompleteReason: body.reason,
    requireArrivedBeforeComplete: true,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}
