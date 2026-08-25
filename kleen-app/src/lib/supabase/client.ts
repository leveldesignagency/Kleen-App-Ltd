import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseAuthCookieOptions } from "@/lib/supabase/auth-cookie-options";

export function createClient() {
  const cookieOptions = getSupabaseAuthCookieOptions();
  return createBrowserClient(
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
}
