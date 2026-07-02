import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isProduction } from "@/lib/security/env";
import { authorizeAdminSecret } from "@/lib/security/env";
import { buildSecuritySnapshot } from "@/lib/security/snapshot";
import { withSecureApiRoute } from "@/lib/security/with-secure-api-route";

export const dynamic = "force-dynamic";

async function healthHandler() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    if (isProduction()) {
      return NextResponse.json({ ok: false, service: "kleen-app" }, { status: 503 });
    }
    return NextResponse.json(
      { ok: false, service: "kleen-app", error: "Supabase not configured" },
      { status: 503 },
    );
  }

  try {
    const supabase = createClient(url, key);
    const { error } = await supabase.from("services").select("id").limit(1);
    if (error) {
      console.error("health check supabase:", error.message);
      if (isProduction()) {
        return NextResponse.json({ ok: false, service: "kleen-app" }, { status: 503 });
      }
      return NextResponse.json(
        { ok: false, service: "kleen-app", error: error.message },
        { status: 503 },
      );
    }
    return NextResponse.json({ ok: true, service: "kleen-app" });
  } catch (e) {
    console.error("health check failed:", e);
    if (isProduction()) {
      return NextResponse.json({ ok: false, service: "kleen-app" }, { status: 503 });
    }
    const message = e instanceof Error ? e.message : "Health check failed";
    return NextResponse.json({ ok: false, service: "kleen-app", error: message }, { status: 503 });
  }
}

export const GET = withSecureApiRoute("default", healthHandler);

/** Full diagnostics with ADMIN_SECRET or CRON_SECRET bearer. */
export async function POST(request: NextRequest) {
  if (!authorizeAdminSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const snapshot = buildSecuritySnapshot();
  return NextResponse.json({ ok: true, service: "kleen-app", security: snapshot });
}
