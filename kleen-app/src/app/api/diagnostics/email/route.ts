import { NextRequest, NextResponse } from "next/server";
import { summarizeResendConfig, testResendSend } from "@/lib/resend-diagnostics";
import { withSecureApiRoute } from "@/lib/security/with-secure-api-route";

export const dynamic = "force-dynamic";

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim() || process.env.ADMIN_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

async function diagnosticsPostHandler(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = summarizeResendConfig();
  const testSend = await testResendSend();

  return NextResponse.json({
    deployment: process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
    config,
    testSend,
  });
}

async function diagnosticsGetHandler(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    deployment: process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
    config: summarizeResendConfig(),
  });
}

export const POST = withSecureApiRoute("sensitive", diagnosticsPostHandler);
export const GET = withSecureApiRoute("sensitive", diagnosticsGetHandler);
