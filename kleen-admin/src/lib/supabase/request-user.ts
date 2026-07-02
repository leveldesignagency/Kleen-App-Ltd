import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest } from "next/server";

/** Resolve Supabase user id from request cookies (for API rate limits). */
export async function getOptionalUserId(request: NextRequest): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(_name: string, _value: string, _options: CookieOptions) {},
      remove(_name: string, _options: CookieOptions) {},
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}
