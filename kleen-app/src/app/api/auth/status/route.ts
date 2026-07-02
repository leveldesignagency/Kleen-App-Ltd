import { NextRequest, NextResponse } from "next/server";
import { isProduction, authorizeAdminSecret } from "@/lib/security/env";
import { buildSecuritySnapshot } from "@/lib/security/snapshot";
import { withSecureApiRoute } from "@/lib/security/with-secure-api-route";

export const dynamic = "force-dynamic";

async function statusHandler() {
  if (isProduction()) {
    return NextResponse.json({
      ok: true,
      service: "kleen-app",
      auth: "supabase",
    });
  }

  return NextResponse.json({
    ok: true,
    service: "kleen-app",
    auth: "supabase",
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
  });
}

export const GET = withSecureApiRoute("default", statusHandler);

/** Detailed probe — requires Bearer ADMIN_SECRET or CRON_SECRET. */
export async function POST(request: NextRequest) {
  if (!authorizeAdminSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    service: "kleen-app",
    security: buildSecuritySnapshot(),
  });
}
