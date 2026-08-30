import { createServiceRoleClient } from "@/lib/supabase/service-role";

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
        reason: "Your account has been restricted by Kleen.",
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

export async function isUserRestricted(userId: string): Promise<boolean> {
  const active = await getActiveBanForUser(userId);
  return Boolean(active);
}
