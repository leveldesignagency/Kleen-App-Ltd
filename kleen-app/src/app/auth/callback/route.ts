import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAuthCookieOptions } from "@/lib/supabase/auth-cookie-options";

/**
 * OAuth PKCE exchange — must use getAll/setAll so cookies attach to the redirect response.
 * @see https://supabase.com/docs/guides/auth/server-side/nextjs
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";

  /** Keep post-login redirect on the same host that received the OAuth callback (session cookies are host-scoped). */
  const sameOrigin = url.origin;

  if (!code) {
    return NextResponse.redirect(new URL("/sign-in", sameOrigin));
  }

  const nextPath = next.startsWith("/") ? next : `/${next}`;
  const redirectTarget = new URL(nextPath, sameOrigin);

  const response = NextResponse.redirect(redirectTarget);

  const cookieOpts = getSupabaseAuthCookieOptions();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      ...(cookieOpts ? { cookieOptions: cookieOpts } : {}),
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("auth callback exchangeCodeForSession:", error.message);
    return NextResponse.redirect(new URL("/sign-in?error=auth", sameOrigin));
  }

  return response;
}
