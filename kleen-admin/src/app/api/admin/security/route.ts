import { NextResponse } from "next/server";
import { requirePermissionApi } from "@/lib/require-admin-api";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { buildSecuritySnapshot } from "@/lib/security/snapshot";
import { buildSecurityWatchdog } from "@/lib/security/watchdog";

/**
 * Security posture + watchdog suite for staff ops.
 * ?full=1 → database health, surface probes, score, charts (slower).
 */
export async function GET(request: Request) {
  const auth = await requirePermissionApi("security.view");
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const full = url.searchParams.get("full") === "1" || url.searchParams.get("watchdog") === "1";

  if (!full) {
    return NextResponse.json({ security: buildSecuritySnapshot() });
  }

  try {
    const supabase = createServiceRoleClient();
    const watchdog = await buildSecurityWatchdog(supabase);
    return NextResponse.json({ security: watchdog.posture, watchdog });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Watchdog failed";
    // Fall back to posture-only if service role missing
    return NextResponse.json(
      {
        security: buildSecuritySnapshot(),
        watchdog: null,
        error: message,
      },
      { status: message.includes("SUPABASE_SERVICE_ROLE") ? 503 : 500 },
    );
  }
}
