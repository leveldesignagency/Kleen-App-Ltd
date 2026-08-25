import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  isSiteAccessGateEnabled,
  isValidSiteAccessCookie,
  siteAccessCredentialsConfigured,
  SITE_ACCESS_COOKIE,
} from "@/lib/site-access-gate";

export async function GET() {
  const enabled = isSiteAccessGateEnabled();
  const credentialsConfigured = siteAccessCredentialsConfigured();
  const flag = process.env.SITE_ACCESS_GATE_ENABLED?.trim().toLowerCase() || "unset";

  if (!enabled) {
    return NextResponse.json({
      unlocked: true,
      enabled: false,
      disabled: true,
      credentialsConfigured,
      flag,
    });
  }

  const cookieStore = await cookies();
  const value = cookieStore.get(SITE_ACCESS_COOKIE)?.value;
  return NextResponse.json({
    unlocked: isValidSiteAccessCookie(value),
    enabled: true,
    credentialsConfigured,
    flag,
  });
}
