import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import {
  hasSiteAccess,
  isSiteAccessGateEnabled,
  siteAccessGateBlocksPath,
} from "@/lib/site-access-gate";

const DASHBOARD_HOST = "dashboard.kleenapp.co.uk";

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const pathname = request.nextUrl.pathname;

  if (
    isSiteAccessGateEnabled() &&
    siteAccessGateBlocksPath(pathname) &&
    !pathname.startsWith("/api/site-access") &&
    !hasSiteAccess(request)
  ) {
    const signIn = new URL("/sign-in", request.url);
    signIn.searchParams.set("next", `${pathname}${request.nextUrl.search || ""}`);
    signIn.searchParams.set("locked", "1");
    return NextResponse.redirect(signIn);
  }

  // On the dashboard subdomain, root "/" should go to the dashboard (not the marketing home)
  if (host === DASHBOARD_HOST && (pathname === "/" || pathname === "")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
