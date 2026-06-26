import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { sendSupportReportEmail } from "@/lib/resend-support-report";

type ReportBody = {
  reportId?: string;
  kind?: string;
  title?: string;
  message?: string;
  detail?: string;
  userMessage?: string;
  page?: string;
  context?: Record<string, unknown>;
};

export async function POST(request: NextRequest) {
  try {
    let body: ReportBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { reportId, kind, title, message, detail, userMessage, page, context } = body;
    if (!reportId?.trim() || !title?.trim() || !message?.trim()) {
      return NextResponse.json({ error: "Missing report fields" }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let userEmail = user?.email || undefined;
    if (user && !userEmail) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", user.id)
        .maybeSingle();
      userEmail = profile?.email || undefined;
    }

    const result = await sendSupportReportEmail({
      reportId: reportId.trim(),
      kind: kind || "unknown",
      title: title.trim(),
      message: message.trim(),
      detail: detail?.trim(),
      userMessage: userMessage?.trim(),
      userEmail,
      page: page?.trim() || request.headers.get("referer") || undefined,
      context,
    });

    if (!result.ok) {
      console.error("support/report:", result.error);
      return NextResponse.json(
        { error: result.error || "Could not send report", reportId },
        { status: 503 },
      );
    }

    return NextResponse.json({ ok: true, reportId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Report failed";
    console.error("support/report unhandled:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
