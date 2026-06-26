import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import {
  hasSiteAccess,
  isSiteAccessGateEnabled,
  siteAccessGateBlocksPath,
} from "@/lib/site-access-gate";
import { getMarketingHomeHref } from "@/lib/customer-app-url";

const DASHBOARD_HOST = "dashboard.kleenapp.co.uk";

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const pathname = request.nextUrl.pathname;

  if (
    isSiteAccessGateEnabled() &&
    siteAccessGateBlocksPath(pathname) &&
    !hasSiteAccess(request)
  ) {
    const signIn = new URL("/sign-in", request.url);
    signIn.searchParams.set("next", `${pathname}${request.nextUrl.search || ""}`);
    return NextResponse.redirect(signIn);
  }

  // On the dashboard subdomain, root "/" should go to the dashboard (not the marketing home)
  if (host === DASHBOARD_HOST && (pathname === "/" || pathname === "")) {
    if (isSiteAccessGateEnabled() && !hasSiteAccess(request)) {
      return NextResponse.redirect(new URL(getMarketingHomeHref()));
    }
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
