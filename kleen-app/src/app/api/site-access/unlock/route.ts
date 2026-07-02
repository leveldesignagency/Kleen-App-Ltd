import { NextRequest, NextResponse } from "next/server";
import {
  isSiteAccessGateEnabled,
  setSiteAccessCookie,
  verifySiteAccessCredentials,
} from "@/lib/site-access-gate";
import { withSecureApiRoute } from "@/lib/security/with-secure-api-route";

async function unlockHandler(request: NextRequest) {
  if (!isSiteAccessGateEnabled()) {
    return NextResponse.json({ ok: true, disabled: true });
  }

  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const username = body.username?.trim() ?? "";
  const password = body.password ?? "";

  if (!verifySiteAccessCredentials(username, password)) {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  setSiteAccessCookie(response);
  return response;
}

export const POST = withSecureApiRoute("auth", unlockHandler);
