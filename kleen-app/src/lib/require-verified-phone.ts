import type { SupabaseClient } from "@supabase/supabase-js";

/** True when the user completed SMS OTP on their profile phone. */
export async function userHasVerifiedPhone(
  admin: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data } = await admin
    .from("profiles")
    .select("phone_verified_at")
    .eq("id", userId)
    .maybeSingle();

  return Boolean(data?.phone_verified_at);
}
