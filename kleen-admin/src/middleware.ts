import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { getOptionalUserId } from "@/lib/supabase/request-user";
import { enforceApiRateLimit } from "@/lib/security/middleware-api";
import { applySecurityHeaders } from "@/lib/security/headers";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith("/api/")) {
    const userId = await getOptionalUserId(request);
    const limited = enforceApiRateLimit(request, userId);
    if (limited) return limited;
  }

  const response = await updateSession(request);
  return applySecurityHeaders(response);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
