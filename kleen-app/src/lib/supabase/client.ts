import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getSupabaseAuthCookieOptions } from "@/lib/supabase/auth-cookie-options";

let browserClient: SupabaseClient | null = null;
let clearingCorruptSession = false;

/** Drop a broken refresh token so the client stops hammering /auth/v1/token. */
async function clearCorruptSession(client: SupabaseClient) {
  if (clearingCorruptSession) return;
  clearingCorruptSession = true;
  try {
    await client.auth.signOut({ scope: "local" });
  } catch (e) {
    console.warn("clearCorruptSession:", e);
  } finally {
    clearingCorruptSession = false;
  }
}

/**
 * Singleton browser client — multiple createBrowserClient() instances each run
 * auto-refresh and can 429 Supabase when a refresh token is invalid.
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

/** Safe session probe — never leave callers hanging on a refresh storm. */
export async function getBrowserUser(): Promise<User | null> {
  const client = createClient();
  try {
    const result = await Promise.race([
      client.auth.getUser(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
    ]);
    if (!result) {
      await clearCorruptSession(client);
      return null;
    }
    const { data, error } = result;
    if (error) {
      const msg = (error.message || "").toLowerCase();
      const status = typeof (error as { status?: number }).status === "number"
        ? (error as { status?: number }).status
        : undefined;
      if (
        msg.includes("refresh") ||
        msg.includes("session") ||
        msg.includes("jwt") ||
        msg.includes("rate") ||
        status === 429 ||
        status === 400
      ) {
        await clearCorruptSession(client);
      }
      return null;
    }
    return data.user ?? null;
  } catch {
    await clearCorruptSession(client);
    return null;
  }
}
