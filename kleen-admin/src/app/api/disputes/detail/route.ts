import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/require-admin-api";
import { loadDisputeContext } from "@/lib/dispute-context";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const disputeId = request.nextUrl.searchParams.get("disputeId")?.trim() || "";
  if (!disputeId) {
    return NextResponse.json({ error: "Missing disputeId" }, { status: 400 });
  }

  const ctx = await loadDisputeContext(disputeId);
  if (!ctx) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ context: ctx });
}
