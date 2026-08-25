import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAdminApi } from "@/lib/require-admin-api";
import { sendContractorAdminInviteEmail } from "@/lib/resend-contractor-lifecycle";

/** Resend confirm-details invite for an admin-created / unclaimed contractor. */
export async function POST(request: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json().catch(() => ({}))) as { id?: string };
    if (!body.id) {
      return NextResponse.json({ error: "Missing contractor id" }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    const { data: op, error } = await supabase
      .from("operatives")
      .select("id, full_name, email, user_id, is_verified")
      .eq("id", body.id)
      .single();

    if (error || !op) {
      return NextResponse.json({ error: error?.message || "Contractor not found" }, { status: 404 });
    }

    if (op.is_verified) {
      return NextResponse.json({ error: "This contractor is already verified." }, { status: 400 });
    }

    const email = String(op.email || "").trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "Contractor has no email address." }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { error: updErr } = await supabase
      .from("operatives")
      .update({
        onboarding_source: "admin_invite",
        admin_invited_at: now,
        email,
      })
      .eq("id", op.id);

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 400 });
    }

    const sendResult = await sendContractorAdminInviteEmail({
      toEmail: email,
      fullName: String(op.full_name || "there"),
    });

    if (!sendResult.ok) {
      return NextResponse.json(
        { error: sendResult.error || "Invite email failed to send" },
        { status: 503 },
      );
    }

    return NextResponse.json({
      ok: true,
      already_linked: Boolean(op.user_id),
    });
  } catch (e) {
    console.error("contractors/invite:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invite failed" },
      { status: 500 },
    );
  }
}
