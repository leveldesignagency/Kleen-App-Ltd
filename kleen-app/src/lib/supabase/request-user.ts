import { createServerClient } from "@supabase/ssr";
import { type NextRequest } from "next/server";
import { getSupabaseAuthCookieOptions } from "@/lib/supabase/auth-cookie-options";

/** Resolve Supabase user id from request cookies (for API rate limits). */
export async function getOptionalUserId(request: NextRequest): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;

  const cookieOptions = getSupabaseAuthCookieOptions();
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    ...(cookieOptions ? { cookieOptions } : {}),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {},
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}
