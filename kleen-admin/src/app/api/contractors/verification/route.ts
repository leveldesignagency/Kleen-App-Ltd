import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAdminApi } from "@/lib/require-admin-api";
import { Resend } from "resend";
import { resolveResendFrom } from "@/lib/resend-config";

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function contractorPortalBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    process.env.CUSTOMER_DASHBOARD_URL?.replace(/\/$/, "") ||
    "https://dashboard.kleenapp.co.uk"
  );
}

/** PostgREST missing column / stale schema cache — retry with fewer fields. */
function shouldRetryOperativesUpdate(message: string | undefined) {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes("schema cache") ||
    m.includes("could not find") ||
    m.includes("pgrst204") ||
    m.includes("submitted_for_review_at") ||
    m.includes("verified_at") ||
    m.includes("rejected_at") ||
    m.includes("rejection_message") ||
    (m.includes("column") && m.includes("operatives"))
  );
}

function getErrorMessage(err: { message?: string } | null) {
  return err?.message ?? "";
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const { operativeId, action, message } = body as {
    operativeId?: string;
    action?: "approve" | "reject";
    message?: string;
  };

  if (!operativeId || !action) {
    return NextResponse.json({ error: "operativeId and action are required" }, { status: 400 });
  }
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "action must be approve or reject" }, { status: 400 });
  }
  if (action === "reject" && (!message || !String(message).trim())) {
    return NextResponse.json(
      { error: "Add a detailed message for the contractor — this is emailed to them." },
      { status: 400 }
    );
  }

  const supabase = createServiceRoleClient();
  const now = new Date().toISOString();

  if (action === "approve") {
    const payloads: Record<string, unknown>[] = [
      {
        is_verified: true,
        verified_at: now,
        submitted_for_review_at: null,
        rejected_at: null,
        rejection_message: null,
      },
      {
        is_verified: true,
        verified_at: now,
        rejected_at: null,
        rejection_message: null,
      },
      { is_verified: true, verified_at: now },
      { is_verified: true },
    ];

    let data: Record<string, unknown> | null = null;
    let lastError: { message?: string } | null = null;
    let usedFallback = false;

    for (let i = 0; i < payloads.length; i++) {
      const { data: row, error } = await supabase
        .from("operatives")
        .update(payloads[i])
        .eq("id", operativeId)
        .select("*")
        .single();

      if (!error) {
        data = row as Record<string, unknown>;
        usedFallback = i > 0;
        break;
      }
      lastError = error;
      if (!shouldRetryOperativesUpdate(getErrorMessage(error))) {
        break;
      }
    }

    if (!data) {
      console.error("contractors/verification approve:", lastError);
      return NextResponse.json(
        { error: getErrorMessage(lastError) || "Approve failed" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      operative: data,
      ...(usedFallback
        ? {
            dbWarning:
              "Contractor was approved using a minimal DB update. Run kleen-app/supabase/manual/ensure_operatives_contractor_verification_columns.sql on Supabase so verification timestamps and the review queue work fully.",
          }
        : {}),
    });
  }

  const { data: before } = await supabase
    .from("operatives")
    .select("email, full_name")
    .eq("id", operativeId)
    .maybeSingle();

  const trimmed = String(message).trim();
  const rejectPayloads: Record<string, unknown>[] = [
    {
      is_verified: false,
      verified_at: null,
      submitted_for_review_at: null,
      rejected_at: now,
      rejection_message: trimmed,
    },
    {
      is_verified: false,
      verified_at: null,
      rejected_at: now,
      rejection_message: trimmed,
    },
    { is_verified: false, rejected_at: now, rejection_message: trimmed },
    { is_verified: false, rejection_message: trimmed },
    { is_verified: false, rejected_at: now },
    { is_verified: false },
  ];

  let data: Record<string, unknown> | null = null;
  let lastError: { message?: string } | null = null;
  let usedFallback = false;

  for (let i = 0; i < rejectPayloads.length; i++) {
    const { data: row, error } = await supabase
      .from("operatives")
      .update(rejectPayloads[i])
      .eq("id", operativeId)
      .select("*")
      .single();

    if (!error) {
      data = row as Record<string, unknown>;
      usedFallback = i > 0;
      break;
    }
    lastError = error;
    if (!shouldRetryOperativesUpdate(getErrorMessage(error))) {
      break;
    }
  }

  if (!data) {
    console.error("contractors/verification reject:", lastError);
    return NextResponse.json({ error: getErrorMessage(lastError) || "Decline failed" }, { status: 400 });
  }

  const toEmail = before?.email?.trim();
  if (toEmail) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          ok: true,
          operative: data,
          emailWarning: "Contractor updated but email was not sent (RESEND_API_KEY missing).",
          ...(usedFallback ? { dbWarning: "Decline used minimal DB columns; run ensure_operatives_contractor_verification_columns.sql for full rejection storage." } : {}),
        },
        { status: 200 }
      );
    }
    const resend = new Resend(apiKey);
    const base = contractorPortalBaseUrl();
    const profileUrl = `${base}/contractor/profile`;
    const htmlBody = `
      <p>Hi ${escapeHtml(before?.full_name || "there")},</p>
      <p>Thanks for applying to work with Kleen as a contractor. After reviewing your application, we are not able to approve your profile at this time.</p>
      <p><strong>What we need you to address</strong></p>
      <div style="white-space:pre-wrap;border-left:3px solid #0d9488;padding-left:12px;margin:16px 0;">${escapeHtml(trimmed).replace(/\n/g, "<br/>")}</div>
      <p>Please update your details in the contractor portal and reply to this email or contact us if you have questions.</p>
      <p><a href="${profileUrl}">Open your contractor profile</a></p>
      <p style="color:#64748b;font-size:12px;margin-top:24px;">— Kleen</p>
    `;
    const { error: sendErr } = await resend.emails.send({
      from: resolveResendFrom(),
      to: toEmail,
      subject: "Update to your Kleen contractor application",
      html: htmlBody,
    });
    if (sendErr) {
      console.error("contractors/verification resend:", sendErr);
      return NextResponse.json(
        {
          ok: true,
          operative: data,
          emailWarning: "Contractor saved but the email failed to send. Check Resend logs.",
          ...(usedFallback ? { dbWarning: "Decline used minimal DB columns; run ensure_operatives_contractor_verification_columns.sql for full rejection storage." } : {}),
        },
        { status: 200 }
      );
    }
  }

  return NextResponse.json({
    ok: true,
    operative: data,
    ...(usedFallback
      ? {
          dbWarning:
            "Decline was saved with minimal columns. Run kleen-app/supabase/manual/ensure_operatives_contractor_verification_columns.sql on Supabase so rejection reasons persist on the profile.",
        }
      : {}),
  });
}
