import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/require-admin-api";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { placeAccountBan, liftAccountBan } from "@/lib/account-ban-service";
import { BAN_REASON_CODES } from "@/lib/account-enforcement";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const tab = request.nextUrl.searchParams.get("tab") || "bans";
  const admin = createServiceRoleClient();

  if (tab === "appeals") {
    const { data } = await admin
      .from("ban_appeals")
      .select(
        "id, ban_id, appellant_user_id, message, status, created_at, reviewed_at, review_notes, account_bans ( reason, ban_type, subject_type, subject_id )",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    return NextResponse.json({ appeals: data || [] });
  }

  if (tab === "flags") {
    const { data } = await admin
      .from("account_risk_flags")
      .select("*")
      .is("resolved_at", null)
      .order("created_at", { ascending: false })
      .limit(200);
    return NextResponse.json({ flags: data || [] });
  }

  if (tab === "blocklist") {
    const { data } = await admin
      .from("identity_blocklist")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    return NextResponse.json({ blocklist: data || [] });
  }

  const includeLifted = request.nextUrl.searchParams.get("includeLifted") === "1";
  let q = admin
    .from("account_bans")
    .select("*")
    .order("placed_at", { ascending: false })
    .limit(100);
  if (!includeLifted) q = q.is("lifted_at", null);

  const { data: bans } = await q;
  return NextResponse.json({ bans: bans || [], reasonCodes: BAN_REASON_CODES });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  let body: {
    action?: string;
    subjectType?: string;
    subjectId?: string;
    banType?: string;
    reasonCode?: string;
    reason?: string;
    expiresAt?: string;
    appealAllowed?: boolean;
    blockIdentities?: boolean;
    banId?: string;
    liftReason?: string;
    removeIdentityBlocks?: boolean;
    appealId?: string;
    appealStatus?: string;
    reviewNotes?: string;
    flagId?: string;
    userId?: string;
    operativeId?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.action === "place_ban") {
    const subjectType = body.subjectType === "contractor" ? "contractor" : "customer";
    const banType = body.banType === "temporary" ? "temporary" : "permanent";
    if (!body.subjectId?.trim() || !body.reason?.trim()) {
      return NextResponse.json({ error: "subjectId and reason required" }, { status: 400 });
    }
    const result = await placeAccountBan({
      subjectType,
      subjectId: body.subjectId.trim(),
      banType,
      reasonCode: (body.reasonCode as (typeof BAN_REASON_CODES)[number]["value"]) || "policy_violation",
      reason: body.reason.trim(),
      expiresAt: body.expiresAt,
      appealAllowed: body.appealAllowed !== false,
      blockIdentities: body.blockIdentities !== false,
      placedBy: auth.userId,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true, banId: result.banId });
  }

  if (body.action === "lift_ban") {
    if (!body.banId) return NextResponse.json({ error: "banId required" }, { status: 400 });
    const result = await liftAccountBan({
      banId: body.banId,
      liftedBy: auth.userId,
      liftReason: body.liftReason?.trim() || "Lifted by admin",
      removeIdentityBlocks: body.removeIdentityBlocks === true,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "review_appeal") {
    if (!body.appealId || !["approved", "rejected"].includes(body.appealStatus || "")) {
      return NextResponse.json({ error: "Invalid appeal review" }, { status: 400 });
    }
    const admin = createServiceRoleClient();
    const { data: appeal } = await admin
      .from("ban_appeals")
      .select("id, ban_id, status")
      .eq("id", body.appealId)
      .maybeSingle();
    if (!appeal || appeal.status !== "pending") {
      return NextResponse.json({ error: "Appeal not found or already reviewed" }, { status: 404 });
    }

    await admin
      .from("ban_appeals")
      .update({
        status: body.appealStatus,
        reviewed_by: auth.userId,
        reviewed_at: new Date().toISOString(),
        review_notes: body.reviewNotes?.trim() || null,
      })
      .eq("id", body.appealId);

    if (body.appealStatus === "approved") {
      await liftAccountBan({
        banId: appeal.ban_id,
        liftedBy: auth.userId,
        liftReason: "Appeal approved",
        removeIdentityBlocks: true,
      });
    }

    return NextResponse.json({ ok: true });
  }

  if (body.action === "resolve_flag") {
    if (!body.flagId) return NextResponse.json({ error: "flagId required" }, { status: 400 });
    const admin = createServiceRoleClient();
    await admin
      .from("account_risk_flags")
      .update({ resolved_at: new Date().toISOString(), resolved_by: auth.userId })
      .eq("id", body.flagId);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "refresh_risk") {
    const admin = createServiceRoleClient();
    if (body.userId) {
      await admin.rpc("refresh_customer_risk_flags", { p_user_id: body.userId });
    }
    if (body.operativeId) {
      await admin.rpc("refresh_contractor_risk_flags", { p_operative_id: body.operativeId });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
