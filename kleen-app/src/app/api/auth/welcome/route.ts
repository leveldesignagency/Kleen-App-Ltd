import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { maybeSendWelcomeEmail } from "@/lib/maybe-send-welcome";
import { withSecureApiRoute } from "@/lib/security/with-secure-api-route";
import { getSupabaseAuthCookieOptions } from "@/lib/supabase/auth-cookie-options";

async function welcomeHandler() {
  const cookieStore = cookies();
  const cookieOpts = getSupabaseAuthCookieOptions();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      ...(cookieOpts ? { cookieOptions: cookieOpts } : {}),
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role === "operative" || profile?.role === "admin") {
    return NextResponse.json({ ok: true, sent: false, reason: "not_customer" });
  }

  const result = await maybeSendWelcomeEmail({ user, audience: "customer" });
  return NextResponse.json({ ok: true, ...result });
}

export const POST = withSecureApiRoute("auth", welcomeHandler, { private: false });
