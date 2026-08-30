import { createServiceRoleClient } from "@/lib/supabase/service-role";

export function normalizeBlockKey(
  blockType: "email" | "phone" | "postcode_address" | "company_number" | "vat_number",
  value: string,
): string {
  const v = value.trim();
  switch (blockType) {
    case "email":
      return v.toLowerCase();
    case "phone":
      return v.replace(/\D/g, "");
    case "postcode_address":
      return v.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    case "company_number":
    case "vat_number":
      return v.replace(/\s+/g, "").toUpperCase();
    default:
      return v.toLowerCase();
  }
}

export function buildPostcodeAddressKey(postcode: string, line1: string): string {
  return normalizeBlockKey("postcode_address", `${postcode}|${line1}`);
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
      .select("id")
      .eq("block_type", c.type)
      .eq("block_key", c.key)
      .maybeSingle();
    if (data) {
      return { blocked: true, reason: "This identity cannot use Kleen services." };
    }
  }
  return { blocked: false };
}
