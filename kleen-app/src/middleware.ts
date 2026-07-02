import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { getOptionalUserId } from "@/lib/supabase/request-user";
import {
  hasSiteAccess,
  isSiteAccessGateEnabled,
  siteAccessGateBlocksPath,
} from "@/lib/site-access-gate";
import { getMarketingHomeHref } from "@/lib/customer-app-url";
import { enforceApiRateLimit } from "@/lib/security/middleware-api";
import { applyPrivateResourceHeaders, applySecurityHeaders } from "@/lib/security/headers";
import { isPrivateApiPath } from "@/lib/security/route-buckets";

const DASHBOARD_HOST = "dashboard.kleenapp.co.uk";

function finalizeResponse(response: NextResponse, pathname: string): NextResponse {
  if (isPrivateApiPath(pathname)) {
    return applyPrivateResourceHeaders(response);
  }
  return applySecurityHeaders(response);
}

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith("/api/")) {
    const userId = await getOptionalUserId(request);
    const limited = enforceApiRateLimit(request, userId);
    if (limited) return limited;
  }

  if (
    isSiteAccessGateEnabled() &&
    siteAccessGateBlocksPath(pathname) &&
    !hasSiteAccess(request)
  ) {
    const signIn = new URL("/sign-in", request.url);
    signIn.searchParams.set("next", `${pathname}${request.nextUrl.search || ""}`);
    return finalizeResponse(NextResponse.redirect(signIn), pathname);
  }

  if (host === DASHBOARD_HOST && (pathname === "/" || pathname === "")) {
    if (isSiteAccessGateEnabled() && !hasSiteAccess(request)) {
      return finalizeResponse(
        NextResponse.redirect(new URL(getMarketingHomeHref())),
        pathname,
      );
    }
    return finalizeResponse(
      NextResponse.redirect(new URL("/dashboard", request.url)),
      pathname,
    );
  }

  const response = await updateSession(request);
  return finalizeResponse(response, pathname);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
