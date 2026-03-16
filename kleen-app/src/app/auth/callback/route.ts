import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { searchParams } = url;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  // After login: send to dashboard. Never redirect to localhost (Vercel must set NEXT_PUBLIC_SITE_URL).
  const requestHost = `${url.protocol}//${url.host}`;
  const dashboardBase =
    process.env.NEXT_PUBLIC_SITE_URL && !process.env.NEXT_PUBLIC_SITE_URL.includes("localhost")
      ? process.env.NEXT_PUBLIC_SITE_URL
      : requestHost.includes("localhost")
        ? "https://dashboard.kleenapp.co.uk"
        : requestHost;

  if (code) {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data?.user) {
      return NextResponse.redirect(`${dashboardBase}${next}`);
    }
  }

  return NextResponse.redirect(`${url.protocol}//${url.host}/sign-in`);
}
