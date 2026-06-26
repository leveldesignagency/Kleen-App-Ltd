import type { NextRequest } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/** Resolve the signed-in customer from cookies (preferred) or Authorization: Bearer access_token. */
export async function getRequestUser(
  request: NextRequest,
): Promise<{ user: User | null; supabase: SupabaseClient }> {
  const cookieClient = createServerSupabaseClient();
  const {
    data: { user: cookieUser },
  } = await cookieClient.auth.getUser();
  if (cookieUser) {
    return { user: cookieUser, supabase: cookieClient };
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    return { user: null, supabase: cookieClient };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return { user: null, supabase: cookieClient };
  }

  const tokenClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const {
    data: { user: tokenUser },
    error,
  } = await tokenClient.auth.getUser(token);

  if (tokenUser && !error) {
    return { user: tokenUser, supabase: tokenClient };
  }

  return { user: null, supabase: cookieClient };
}
