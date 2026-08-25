import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  isSiteAccessGateEnabled,
  isValidSiteAccessCookie,
  SITE_ACCESS_COOKIE,
} from "@/lib/site-access-gate";

export async function GET() {
  const enabled = isSiteAccessGateEnabled();
  if (!enabled) {
    return NextResponse.json({ unlocked: true, enabled: false, disabled: true });
  }
  const cookieStore = await cookies();
  const value = cookieStore.get(SITE_ACCESS_COOKIE)?.value;
  return NextResponse.json({
    unlocked: isValidSiteAccessCookie(value),
    enabled: true,
  });
}
