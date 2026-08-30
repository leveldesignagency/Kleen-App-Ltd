import { createServiceRoleClient } from "@/lib/supabase/service-role";

const PLATFORM_FEE_RATE = 0.175;

export async function logDisputeAction(params: {
  disputeId: string;
  actorId: string;
  actionType: string;
  summary: string;
  metadata?: Record<string, unknown>;
}) {
  const admin = createServiceRoleClient();
  await admin.from("dispute_actions").insert({
    dispute_id: params.disputeId,
    actor_id: params.actorId,
    action_type: params.actionType,
    summary: params.summary,
    metadata: params.metadata ?? {},
  });
}

export async function loadDisputeContext(disputeId: string) {
  const admin = createServiceRoleClient();

  const { data: dispute, error: dErr } = await admin
    .from("disputes")
    .select(
      "id, job_id, user_id, status, reason, resolution, resolution_type, refund_amount_pence, promo_code_id, internal_notes, created_at, resolved_at, resolved_by",
    )
    .eq("id", disputeId)
    .maybeSingle();

  if (dErr || !dispute) return null;

  const { data: job } = await admin
    .from("jobs")
    .select(
      "id, reference, status, user_id, accepted_quote_request_id, payment_authorized_at, payment_captured_at, funds_released_at, stripe_payment_intent_id, escrow_release_date, preferred_date, postcode, service_id, operative_marked_complete_at, customer_confirmed_complete_at, contractor_confirmed_complete_at",
    )
    .eq("id", dispute.job_id)
    .maybeSingle();

  const { data: payment } = await admin
    .from("payments")
    .select("amount_pence, refund_amount_pence, status, currency, paid_at")
    .eq("job_id", dispute.job_id)
    .maybeSingle();

  let customerPricePence: number | null = null;
  let contractorQuotePence: number | null = null;
  if (job?.accepted_quote_request_id) {
    const { data: resp } = await admin
      .from("quote_responses")
      .select("customer_price_pence, price_pence")
      .eq("quote_request_id", job.accepted_quote_request_id)
      .maybeSingle();
    customerPricePence = resp?.customer_price_pence ?? null;
    contractorQuotePence = resp?.price_pence ?? null;
  }

  const refunded = payment?.refund_amount_pence ?? 0;
  const charged = payment?.amount_pence ?? customerPricePence ?? 0;
  const remainingRefundable = Math.max(0, charged - refunded);
  const netAfterRefund = Math.max(0, (customerPricePence ?? charged) - refunded);
  const contractorSharePence = Math.round(netAfterRefund * (1 - PLATFORM_FEE_RATE));
  const platformFeePence = netAfterRefund - contractorSharePence;

  let customer: { id: string; name: string; email: string } | null = null;
  if (dispute.user_id) {
    const { data: prof } = await admin
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", dispute.user_id)
      .maybeSingle();
    if (prof) {
      customer = {
        id: prof.id,
        name: prof.full_name?.trim() || "Customer",
        email: prof.email?.trim() || "",
      };
    }
  }

  let contractor: { id: string; name: string; email: string } | null = null;
  const { data: assignment } = await admin
    .from("job_assignments")
    .select("operative_id, operatives ( id, full_name, email, user_id )")
    .eq("job_id", dispute.job_id)
    .limit(1)
    .maybeSingle();
  const op = Array.isArray(assignment?.operatives) ? assignment?.operatives[0] : assignment?.operatives;
  if (op) {
    let email = (op as { email?: string | null }).email || "";
    const uid = (op as { user_id?: string | null }).user_id;
    if (!email && uid) {
      const { data: authUser } = await admin.auth.admin.getUserById(uid);
      email = authUser.user?.email ?? "";
    }
    contractor = {
      id: String((op as { id: string }).id),
      name: (op as { full_name?: string | null }).full_name?.trim() || "Contractor",
      email,
    };
  }

  let promoCode: string | null = null;
  if (dispute.promo_code_id) {
    const { data: promo } = await admin
      .from("promo_codes")
      .select("code")
      .eq("id", dispute.promo_code_id)
      .maybeSingle();
    promoCode = promo?.code ?? null;
  }

  const { data: actions } = await admin
    .from("dispute_actions")
    .select("id, actor_id, action_type, summary, metadata, created_at")
    .eq("dispute_id", disputeId)
    .order("created_at", { ascending: false })
    .limit(50);

  const { count: customerDisputeCount } = await admin
    .from("disputes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", dispute.user_id);

  const { data: customerFlags } = dispute.user_id
    ? await admin
        .from("account_risk_flags")
        .select("id, flag_type, severity, notes, created_at")
        .eq("subject_type", "customer")
        .eq("subject_id", dispute.user_id)
        .is("resolved_at", null)
        .order("created_at", { ascending: false })
        .limit(10)
    : { data: [] };

  let contractorFlags: typeof customerFlags = [];
  if (contractor) {
    const { data: flags } = await admin
      .from("account_risk_flags")
      .select("id, flag_type, severity, notes, created_at")
      .eq("subject_type", "contractor")
      .eq("subject_id", contractor.id)
      .is("resolved_at", null)
      .order("created_at", { ascending: false })
      .limit(10);
    contractorFlags = flags || [];
  }

  return {
    dispute,
    job,
    payment: payment ?? null,
    pricing: {
      customerPricePence,
      contractorQuotePence,
      chargedPence: charged,
      refundedPence: refunded,
      remainingRefundablePence: remainingRefundable,
      contractorSharePence,
      platformFeePence,
      netAfterRefundPence: netAfterRefund,
    },
    customer,
    contractor,
    promoCode,
    actions: actions ?? [],
    customerHistory: { priorDisputes: Math.max(0, (customerDisputeCount ?? 1) - 1) },
    riskFlags: {
      customer: customerFlags || [],
      contractor: contractorFlags || [],
    },
  };
}

export type DisputeContext = NonNullable<Awaited<ReturnType<typeof loadDisputeContext>>>;
