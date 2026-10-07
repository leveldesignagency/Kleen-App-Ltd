import { NextRequest, NextResponse } from "next/server";
import { checkPostcodeIsKent } from "@/lib/service-area-kent";
import { withSecureApiRoute } from "@/lib/security/with-secure-api-route";

async function getHandler(request: NextRequest) {
  const postcode = request.nextUrl.searchParams.get("postcode") || "";
  const result = await checkPostcodeIsKent(postcode);
  if (!result.ok) {
    return NextResponse.json({ error: result.error, postcode: result.postcode }, { status: 400 });
  }
  return NextResponse.json({
    inKent: result.inKent,
    postcode: result.postcode,
    areaLabel: result.areaLabel,
  });
}

async function postHandler(request: NextRequest) {
  let body: { postcode?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const result = await checkPostcodeIsKent(body.postcode || "");
  if (!result.ok) {
    return NextResponse.json({ error: result.error, postcode: result.postcode }, { status: 400 });
  }
  return NextResponse.json({
    inKent: result.inKent,
    postcode: result.postcode,
    areaLabel: result.areaLabel,
  });
}

export const GET = withSecureApiRoute("auth", getHandler, { private: false });
export const POST = withSecureApiRoute("auth", postHandler, { private: false });
