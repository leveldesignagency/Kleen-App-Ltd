import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getSupabaseAuthCookieOptions } from "@/lib/supabase/auth-cookie-options";

let browserClient: SupabaseClient | null = null;

/**
 * Singleton browser client — avoids multiple auto-refresh loops from
 * createBrowserClient() being constructed on every call.
 */
export function createClient() {
  if (browserClient) return browserClient;

  const cookieOptions = getSupabaseAuthCookieOptions();
  browserClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      ...(cookieOptions ? { cookieOptions } : {}),
      auth: {
        flowType: "pkce",
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      },
    },
  );

  return browserClient;
}

/** Read the current user without destroying a valid session on transient errors. */
export async function getBrowserUser(): Promise<User | null> {
  const client = createClient();
  try {
    const { data, error } = await client.auth.getUser();
    if (error) {
      console.warn("getBrowserUser:", error.message);
      return null;
    }
    return data.user ?? null;
  } catch (e) {
    console.warn("getBrowserUser:", e);
    return null;
  }
}
