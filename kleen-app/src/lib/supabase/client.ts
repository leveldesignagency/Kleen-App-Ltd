import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getSupabaseAuthCookieOptions } from "@/lib/supabase/auth-cookie-options";

let browserClient: SupabaseClient | null = null;
let clearingCorruptSession = false;

/** Remove Supabase auth cookies on this host (stops refresh_token 400 loops). */
function wipeSupabaseAuthCookies() {
  if (typeof document === "undefined") return;
  const cookies = document.cookie.split(";").map((c) => c.trim()).filter(Boolean);
  const expire = "Thu, 01 Jan 1970 00:00:00 GMT";
  const domains = ["", ".kleenapp.co.uk", window.location.hostname];
  for (const raw of cookies) {
    const name = raw.split("=")[0]?.trim();
    if (!name) continue;
    if (!name.startsWith("sb-") && !name.includes("auth-token")) continue;
    document.cookie = `${name}=; expires=${expire}; path=/`;
    for (const domain of domains) {
      if (!domain) continue;
      document.cookie = `${name}=; expires=${expire}; path=/; domain=${domain}`;
    }
  }
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && (key.startsWith("sb-") || key.includes("supabase"))) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    /* ignore */
  }
}

async function clearCorruptSession(client: SupabaseClient) {
  if (clearingCorruptSession) return;
  clearingCorruptSession = true;
  try {
    wipeSupabaseAuthCookies();
    await client.auth.signOut({ scope: "local" });
  } catch (e) {
    console.warn("clearCorruptSession:", e);
    wipeSupabaseAuthCookies();
  } finally {
    clearingCorruptSession = false;
  }
}

/**
 * Singleton browser client.
 * autoRefreshToken is OFF — a bad refresh token was causing unbounded /auth/v1/token 400 storms.
 * Call getBrowserUser() / getSession when you need auth; it will clear corrupt sessions once.
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
        // CRITICAL: do not auto-loop refresh on bad tokens
        autoRefreshToken: false,
      },
    },
  );

  return browserClient;
}

/** Safe session probe — clears corrupt tokens instead of retrying forever. */
export async function getBrowserUser(): Promise<User | null> {
  const client = createClient();
  try {
    const result = await Promise.race([
      client.auth.getUser(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
    ]);
    if (!result) {
      await clearCorruptSession(client);
      return null;
    }
    const { data, error } = result;
    if (error) {
      await clearCorruptSession(client);
      return null;
    }
    return data.user ?? null;
  } catch {
    await clearCorruptSession(client);
    return null;
  }
}

/** Call once on gated app entry to kill a stuck refresh loop from prior deploys. */
export async function neutralizeAuthStorm() {
  const client = createClient();
  await clearCorruptSession(client);
}
