import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { withSecureApiRoute } from "@/lib/security/with-secure-api-route";

async function listMessagesHandler(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const disputeId = request.nextUrl.searchParams.get("disputeId")?.trim() || "";
  if (!disputeId) {
    return NextResponse.json({ error: "Missing disputeId" }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const { data: dispute } = await admin
    .from("disputes")
    .select("id, user_id")
    .eq("id", disputeId)
    .maybeSingle();

  if (!dispute || dispute.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: messages, error } = await admin
    .from("dispute_messages")
    .select("id, sender_id, recipient_role, message, created_at")
    .eq("dispute_id", disputeId)
    .or(`sender_id.eq.${user.id},recipient_role.eq.customer`)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ messages: messages || [] });
}

async function sendMessageHandler(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { disputeId?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const disputeId = typeof body.disputeId === "string" ? body.disputeId.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!disputeId || message.length < 1) {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const { data: dispute } = await admin
    .from("disputes")
    .select("id, user_id, status")
    .eq("id", disputeId)
    .maybeSingle();

  if (!dispute || dispute.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (dispute.status === "resolved" || dispute.status === "closed") {
    return NextResponse.json({ error: "This dispute is closed." }, { status: 400 });
  }

  const { error } = await admin.from("dispute_messages").insert({
    dispute_id: disputeId,
    sender_id: user.id,
    recipient_role: "admin",
    message,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export const GET = withSecureApiRoute("default", listMessagesHandler, { private: false });
export const POST = withSecureApiRoute("write", sendMessageHandler, { private: false });
