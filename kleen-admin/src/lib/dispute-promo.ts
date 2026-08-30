import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { customerDashboardUrl, emailLayout, escapeHtml } from "@/lib/email/layout";
import { sendKleenEmail } from "@/lib/email/send";
import crypto from "crypto";

export type GoodwillPromoParams = {
  customerUserId: string;
  disputeId: string;
  discountKind: "percentage" | "fixed";
  discountValue: number;
  description: string;
  validDays?: number;
};

export async function issueGoodwillPromo(params: GoodwillPromoParams): Promise<
  | { ok: true; promoCodeId: string; code: string }
  | { ok: false; error: string }
> {
  const admin = createServiceRoleClient();
  const code = `KLEEN-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + (params.validDays ?? 90));

  const { data: promo, error } = await admin
    .from("promo_codes")
    .insert({
      code,
      description: params.description.slice(0, 500),
      discount_kind: params.discountKind,
      discount_value: params.discountValue,
      max_uses: 1,
      per_user_limit: 1,
      valid_until: validUntil.toISOString(),
      is_active: true,
    })
    .select("id, code")
    .single();

  if (error || !promo) {
    return { ok: false, error: error?.message || "Could not create promo code" };
  }

  const { data: prof } = await admin
    .from("profiles")
    .select("full_name, email")
    .eq("id", params.customerUserId)
    .maybeSingle();

  if (prof?.email) {
    const discountLabel =
      params.discountKind === "percentage"
        ? `${params.discountValue}% off`
        : `£${(params.discountValue / 100).toFixed(2)} off`;
    const html = emailLayout({
      title: "A goodwill gesture from Kleen",
      heading: "Your discount code",
      introHtml: `<p>Hi ${escapeHtml(prof.full_name?.trim() || "there")}, as part of resolving your recent case, Kleen has issued you a discount for your next booking.</p>`,
      rows: [
        { label: "Code", value: `<strong>${escapeHtml(promo.code)}</strong>` },
        { label: "Discount", value: escapeHtml(discountLabel) },
        { label: "Valid until", value: validUntil.toLocaleDateString("en-GB") },
      ],
      cta: { href: customerDashboardUrl("/job-flow"), label: "Book your next clean" },
      footerNote: "Apply this code at checkout when booking. Single use.",
    });
    void sendKleenEmail({
      to: prof.email,
      subject: `Your Kleen discount code — ${promo.code}`,
      html,
    }).catch((e) => console.error("goodwill promo email:", e));
  }

  return { ok: true, promoCodeId: promo.id, code: promo.code };
}
