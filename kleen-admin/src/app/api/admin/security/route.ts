import { NextResponse } from "next/server";
import { requirePermissionApi } from "@/lib/require-admin-api";
import { buildSecuritySnapshot } from "@/lib/security/snapshot";

/** Security posture for staff ops (admin session required). */
export async function GET() {
  const auth = await requirePermissionApi("security.view");
  if (!auth.ok) return auth.response;

  return NextResponse.json({ security: buildSecuritySnapshot() });
}
