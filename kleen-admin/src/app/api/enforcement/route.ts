import { NextRequest, NextResponse } from "next/server";
import { requirePermissionApi } from "@/lib/require-admin-api";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { placeAccountBan, liftAccountBan } from "@/lib/account-ban-service";
import { BAN_REASON_CODES } from "@/lib/account-enforcement";

export async function GET(request: NextRequest) {
  const auth = await requirePermissionApi("enforcement.view");
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
    const flags = await enrichSubjects(admin, data || []);
    return NextResponse.json({ flags });
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
  const enriched = await enrichSubjects(admin, bans || []);
  return NextResponse.json({ bans: enriched, reasonCodes: BAN_REASON_CODES });
}

async function enrichSubjects(
  admin: ReturnType<typeof createServiceRoleClient>,
  rows: Array<Record<string, unknown>>,
) {
  const customerIds = rows
    .filter((r) => r.subject_type === "customer" || r.subject_type === "user")
    .map((r) => String(r.subject_id));
  const contractorIds = rows
    .filter((r) => r.subject_type === "contractor" || r.subject_type === "operative")
    .map((r) => String(r.subject_id));

  const [customers, contractors] = await Promise.all([
    customerIds.length
      ? admin.from("profiles").select("id, full_name, email").in("id", customerIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null; email: string | null }> }),
    contractorIds.length
      ? admin
          .from("operatives")
          .select("id, full_name, email, company_name")
          .in("id", contractorIds)
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            full_name: string | null;
            email: string | null;
            company_name: string | null;
          }>,
        }),
  ]);

  const custMap = new Map((customers.data || []).map((c) => [c.id, c]));
  const opMap = new Map((contractors.data || []).map((o) => [o.id, o]));

  return rows.map((r) => {
    const id = String(r.subject_id);
    if (r.subject_type === "customer" || r.subject_type === "user") {
      const c = custMap.get(id);
      return {
        ...r,
        subject_label: c?.full_name?.trim() || c?.email || null,
        subject_detail: c?.email || null,
      };
    }
    if (r.subject_type === "contractor" || r.subject_type === "operative") {
      const o = opMap.get(id);
      return {
        ...r,
        subject_label: o?.company_name?.trim() || o?.full_name?.trim() || o?.email || null,
        subject_detail: [o?.full_name, o?.email].filter(Boolean).join(" · ") || null,
      };
    }
    return { ...r, subject_label: null, subject_detail: null };
  });
}

export async function POST(request: NextRequest) {
  const auth = await requirePermissionApi("enforcement.manage");
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
      return NextResponse.json(
        { error: "Select an account and enter a reason shown to the user." },
        { status: 400 },
      );
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
