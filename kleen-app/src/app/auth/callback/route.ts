import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { searchParams } = url;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  // After login: always send to dashboard.kleenapp.co.uk (set NEXT_PUBLIC_SITE_URL on Vercel)
  const dashboardBase =
    process.env.NEXT_PUBLIC_SITE_URL || `${url.protocol}//${url.host}`;

  if (code) {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data?.user) {
      return NextResponse.redirect(`${dashboardBase}${next}`);
    }
  }

  return NextResponse.redirect(`${url.protocol}//${url.host}/sign-in`);
}
