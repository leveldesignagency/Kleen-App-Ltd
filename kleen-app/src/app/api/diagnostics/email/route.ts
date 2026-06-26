import { NextRequest, NextResponse } from "next/server";
import { summarizeResendConfig, testResendSend } from "@/lib/resend-diagnostics";

export const dynamic = "force-dynamic";

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/** POST with Authorization: Bearer CRON_SECRET — sends a test email and returns Resend config diagnostics. */
export async function POST(request: NextRequest) {
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

/** GET — config only (no send), still requires CRON_SECRET. */
export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    deployment: process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
    config: summarizeResendConfig(),
  });
}
