import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  buildPostcodeAddressKey,
  normalizeBlockKey,
  type BAN_REASON_CODES,
} from "@/lib/account-enforcement";

type BanReasonCode = (typeof BAN_REASON_CODES)[number]["value"];

export type PlaceBanParams = {
  subjectType: "customer" | "contractor";
  subjectId: string;
  banType: "temporary" | "permanent";
  reasonCode: BanReasonCode;
  reason: string;
  expiresAt?: string | null;
  appealAllowed?: boolean;
  blockIdentities?: boolean;
  placedBy: string;
};

export async function placeAccountBan(params: PlaceBanParams) {
  const admin = createServiceRoleClient();

  const { data: ban, error } = await admin
    .from("account_bans")
    .insert({
      subject_type: params.subjectType,
      subject_id: params.subjectId,
      ban_type: params.banType,
      reason_code: params.reasonCode,
      reason: params.reason,
      expires_at: params.banType === "temporary" ? params.expiresAt : null,
      appeal_allowed: params.appealAllowed ?? true,
      placed_by: params.placedBy,
    })
    .select("id")
    .single();

  if (error || !ban) {
    return { ok: false as const, error: error?.message || "Could not place ban" };
  }

  if (params.subjectType === "customer") {
    await admin.from("profiles").update({ is_blocked: true }).eq("id", params.subjectId);
    if (params.blockIdentities !== false && params.banType === "permanent") {
      await blockCustomerIdentities(admin, params.subjectId, ban.id);
    }
  } else {
    await admin.from("operatives").update({ is_active: false }).eq("id", params.subjectId);
    const { data: op } = await admin
      .from("operatives")
      .select("user_id")
      .eq("id", params.subjectId)
      .maybeSingle();
    if (op?.user_id) {
      await admin.from("profiles").update({ is_blocked: true }).eq("id", op.user_id);
    }
    if (params.blockIdentities !== false && params.banType === "permanent") {
      await blockContractorIdentities(admin, params.subjectId, ban.id);
    }
  }

  return { ok: true as const, banId: ban.id };
}

export async function liftAccountBan(params: {
  banId: string;
  liftedBy: string;
  liftReason: string;
  removeIdentityBlocks?: boolean;
}) {
  const admin = createServiceRoleClient();
  const { data: ban } = await admin
    .from("account_bans")
    .select("id, subject_type, subject_id, ban_type")
    .eq("id", params.banId)
    .maybeSingle();

  if (!ban) return { ok: false as const, error: "Ban not found" };

  await admin
    .from("account_bans")
    .update({
      lifted_at: new Date().toISOString(),
      lifted_by: params.liftedBy,
      lift_reason: params.liftReason,
    })
    .eq("id", params.banId);

  if (ban.subject_type === "customer") {
    const { data: other } = await admin
      .from("account_bans")
      .select("id")
      .eq("subject_type", "customer")
      .eq("subject_id", ban.subject_id)
      .is("lifted_at", null)
      .neq("id", ban.id)
      .limit(1);
    if (!other?.length) {
      await admin.from("profiles").update({ is_blocked: false }).eq("id", ban.subject_id);
    }
  } else {
    const { data: op } = await admin
      .from("operatives")
      .select("user_id")
      .eq("id", ban.subject_id)
      .maybeSingle();
    const { data: other } = await admin
      .from("account_bans")
      .select("id")
      .eq("subject_type", "contractor")
      .eq("subject_id", ban.subject_id)
      .is("lifted_at", null)
      .neq("id", ban.id)
      .limit(1);
    if (!other?.length) {
      await admin.from("operatives").update({ is_active: true }).eq("id", ban.subject_id);
      if (op?.user_id) {
        const { data: custBan } = await admin
          .from("account_bans")
          .select("id")
          .eq("subject_type", "customer")
          .eq("subject_id", op.user_id)
          .is("lifted_at", null)
          .limit(1);
        if (!custBan?.length) {
          await admin.from("profiles").update({ is_blocked: false }).eq("id", op.user_id);
        }
      }
    }
  }

  if (params.removeIdentityBlocks && ban.ban_type === "permanent") {
    await admin.from("identity_blocklist").delete().eq("source_ban_id", ban.id);
  }

  return { ok: true as const };
}

async function blockCustomerIdentities(
  admin: ReturnType<typeof createServiceRoleClient>,
  userId: string,
  banId: string,
) {
  const { data: prof } = await admin
    .from("profiles")
    .select("email, phone")
    .eq("id", userId)
    .maybeSingle();
  const rows: Array<{ block_type: string; block_key: string; display_hint: string; source_ban_id: string }> = [];

  if (prof?.email) {
    rows.push({
      block_type: "email",
      block_key: normalizeBlockKey("email", prof.email),
      display_hint: prof.email,
      source_ban_id: banId,
    });
  }
  if (prof?.phone) {
    rows.push({
      block_type: "phone",
      block_key: normalizeBlockKey("phone", prof.phone),
      display_hint: prof.phone.slice(0, 6) + "…",
      source_ban_id: banId,
    });
  }

  const { data: addresses } = await admin
    .from("addresses")
    .select("line_1, postcode")
    .eq("user_id", userId);
  for (const a of addresses || []) {
    if (a.postcode && a.line_1) {
      rows.push({
        block_type: "postcode_address",
        block_key: buildPostcodeAddressKey(a.postcode, a.line_1),
        display_hint: `${a.line_1}, ${a.postcode}`,
        source_ban_id: banId,
      });
    }
  }

  const { data: biz } = await admin
    .from("business_profiles")
    .select("company_number, vat_number")
    .eq("user_id", userId)
    .maybeSingle();
  if (biz?.company_number) {
    rows.push({
      block_type: "company_number",
      block_key: normalizeBlockKey("company_number", biz.company_number),
      display_hint: biz.company_number,
      source_ban_id: banId,
    });
  }
  if (biz?.vat_number) {
    rows.push({
      block_type: "vat_number",
      block_key: normalizeBlockKey("vat_number", biz.vat_number),
      display_hint: biz.vat_number,
      source_ban_id: banId,
    });
  }

  if (rows.length) {
    await admin.from("identity_blocklist").upsert(rows, { onConflict: "block_type,block_key" });
  }
}

async function blockContractorIdentities(
  admin: ReturnType<typeof createServiceRoleClient>,
  operativeId: string,
  banId: string,
) {
  const { data: op } = await admin
    .from("operatives")
    .select("email, phone, company_number, vat_number, registered_address")
    .eq("id", operativeId)
    .maybeSingle();

  const rows: Array<{ block_type: string; block_key: string; display_hint: string; source_ban_id: string }> = [];

  if (op?.email) {
    rows.push({
      block_type: "email",
      block_key: normalizeBlockKey("email", op.email),
      display_hint: op.email,
      source_ban_id: banId,
    });
  }
  if (op?.phone) {
    rows.push({
      block_type: "phone",
      block_key: normalizeBlockKey("phone", op.phone),
      display_hint: op.phone.slice(0, 6) + "…",
      source_ban_id: banId,
    });
  }
  if (op?.company_number) {
    rows.push({
      block_type: "company_number",
      block_key: normalizeBlockKey("company_number", op.company_number),
      display_hint: op.company_number,
      source_ban_id: banId,
    });
  }
  if (op?.vat_number) {
    rows.push({
      block_type: "vat_number",
      block_key: normalizeBlockKey("vat_number", op.vat_number),
      display_hint: op.vat_number,
      source_ban_id: banId,
    });
  }
  if (op?.registered_address) {
    const parts = String(op.registered_address).split(",");
    const line1 = parts[0]?.trim() || "";
    const postcode = parts[parts.length - 1]?.trim() || "";
    if (line1 && postcode) {
      rows.push({
        block_type: "postcode_address",
        block_key: buildPostcodeAddressKey(postcode, line1),
        display_hint: op.registered_address.slice(0, 80),
        source_ban_id: banId,
      });
    }
  }

  if (rows.length) {
    await admin.from("identity_blocklist").upsert(rows, { onConflict: "block_type,block_key" });
  }
}

export async function checkIdentityBlocked(params: {
  email?: string | null;
  phone?: string | null;
  postcode?: string | null;
  addressLine1?: string | null;
  companyNumber?: string | null;
  vatNumber?: string | null;
}): Promise<{ blocked: boolean; reason?: string }> {
  const admin = createServiceRoleClient();
  const checks: Array<{ type: string; key: string }> = [];

  if (params.email) checks.push({ type: "email", key: normalizeBlockKey("email", params.email) });
  if (params.phone) checks.push({ type: "phone", key: normalizeBlockKey("phone", params.phone) });
  if (params.postcode && params.addressLine1) {
    checks.push({
      type: "postcode_address",
      key: buildPostcodeAddressKey(params.postcode, params.addressLine1),
    });
  }
  if (params.companyNumber) {
    checks.push({
      type: "company_number",
      key: normalizeBlockKey("company_number", params.companyNumber),
    });
  }
  if (params.vatNumber) {
    checks.push({ type: "vat_number", key: normalizeBlockKey("vat_number", params.vatNumber) });
  }

  for (const c of checks) {
    const { data } = await admin
      .from("identity_blocklist")
      .select("display_hint")
      .eq("block_type", c.type)
      .eq("block_key", c.key)
      .maybeSingle();
    if (data) {
      return { blocked: true, reason: `Blocked identity (${c.type})` };
    }
  }
  return { blocked: false };
}

export async function getActiveBanForUser(userId: string) {
  const admin = createServiceRoleClient();
  const { data: custBan } = await admin
    .from("account_bans")
    .select("id, ban_type, reason, reason_code, expires_at, appeal_allowed, placed_at")
    .eq("subject_type", "customer")
    .eq("subject_id", userId)
    .is("lifted_at", null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("placed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (custBan) return { ban: custBan, subjectType: "customer" as const };

  const { data: op } = await admin.from("operatives").select("id").eq("user_id", userId).maybeSingle();
  if (op?.id) {
    const { data: opBan } = await admin
      .from("account_bans")
      .select("id, ban_type, reason, reason_code, expires_at, appeal_allowed, placed_at")
      .eq("subject_type", "contractor")
      .eq("subject_id", op.id)
      .is("lifted_at", null)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order("placed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (opBan) return { ban: opBan, subjectType: "contractor" as const };
  }

  const { data: prof } = await admin.from("profiles").select("is_blocked").eq("id", userId).maybeSingle();
  if (prof?.is_blocked) {
    return {
      ban: {
        id: "legacy",
        ban_type: "permanent",
        reason: "Account restricted by Kleen.",
        reason_code: "policy_violation",
        expires_at: null,
        appeal_allowed: true,
        placed_at: new Date().toISOString(),
      },
      subjectType: "customer" as const,
    };
  }

  return null;
}
