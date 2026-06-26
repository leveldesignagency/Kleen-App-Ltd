import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/** Lightweight check that Supabase is reachable (for job-flow / dashboard). */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return NextResponse.json(
      { ok: false, supabase: false, error: "Supabase not configured" },
      { status: 503 },
    );
  }

  try {
    const supabase = createClient(url, key);
    const { error } = await supabase.from("services").select("id").limit(1);
    if (error) {
      console.error("health check supabase:", error.message);
      return NextResponse.json(
        { ok: false, supabase: false, error: error.message },
        { status: 503 },
      );
    }
    return NextResponse.json({ ok: true, supabase: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Health check failed";
    return NextResponse.json({ ok: false, supabase: false, error: message }, { status: 503 });
  }
}
