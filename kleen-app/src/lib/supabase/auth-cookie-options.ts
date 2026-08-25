import type { CookieOptionsWithName } from "@supabase/ssr";

/**
 * Share Supabase auth cookies across www + dashboard (leading dot).
 * Required so PKCE code-verifier set on one host works when OAuth returns on another.
 *
 * Override with NEXT_PUBLIC_AUTH_COOKIE_DOMAIN (e.g. .kleenapp.co.uk).
 * In production on kleenapp.co.uk we default to .kleenapp.co.uk when unset.
 */
export function getSupabaseAuthCookieOptions(): CookieOptionsWithName | undefined {
  const configured = process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN?.trim();
  const domain =
    configured ||
    (process.env.NODE_ENV === "production" ? ".kleenapp.co.uk" : undefined);

  if (!domain) return undefined;

  return {
    domain,
    path: "/",
    sameSite: "lax",
    secure: true,
  };
}
