import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAdminApi } from "@/lib/require-admin-api";

/**
 * Creates a Stripe Connect Custom account (GB) for the operative (if missing),
 * attaches the UK bank account from operatives.* fields, and saves stripe_account_id.
 * Required for stripe.transfers.create in release-funds.
 *
 * Stripe may require extra verification in the Dashboard before payouts go live.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
  }

  try {
    const body = await request.json();
    const {
      operativeId,
      bank_account_name: bodyName,
      bank_sort_code: bodySort,
      bank_account_number: bodyAcct,
    } = body as {
      operativeId?: string;
      bank_account_name?: string | null;
      bank_sort_code?: string | null;
      bank_account_number?: string | null;
    };
    if (!operativeId) {
      return NextResponse.json({ error: "Missing operativeId" }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    const { data: op, error: opErr } = await supabase
      .from("operatives")
      .select(
        "id, email, full_name, contractor_type, company_name, bank_account_name, bank_sort_code, bank_account_number, stripe_account_id"
      )
      .eq("id", operativeId)
      .single();

    if (opErr || !op) {
      return NextResponse.json({ error: "Contractor not found" }, { status: 404 });
    }

    const sort = (bodySort ?? op.bank_sort_code ?? "").replace(/\D/g, "");
    const acctNum = (bodyAcct ?? op.bank_account_number ?? "").replace(/\D/g, "");
    const holder = (bodyName ?? op.bank_account_name ?? "").trim();

    if (!holder || sort.length !== 6 || acctNum.length !== 8) {
      return NextResponse.json(
        {
          error:
            "Enter complete bank details: account holder name, 6-digit sort code, and 8-digit account number.",
        },
        { status: 400 }
      );
    }

    const bankFromForm =
      bodyName !== undefined || bodySort !== undefined || bodyAcct !== undefined;
    if (bankFromForm) {
      await supabase
        .from("operatives")
        .update({
          bank_account_name: holder,
          bank_sort_code: sort,
          bank_account_number: acctNum,
        })
        .eq("id", operativeId);
    }

    const stripe = new Stripe(stripeKey);
    const email = (op.email || "").trim();
    if (!email) {
      return NextResponse.json({ error: "Contractor email is required for Stripe." }, { status: 400 });
    }

    const forwarded = request.headers.get("x-forwarded-for");
    const clientIp = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "127.0.0.1";

    let accountId = (op.stripe_account_id || "").trim();

    if (!accountId) {
      const nameParts = (op.full_name || "").trim().split(/\s+/).filter(Boolean);
      const first_name = nameParts[0] || "Contractor";
      const last_name = nameParts.slice(1).join(" ") || nameParts[0] || "Contractor";
      const isCompany = op.contractor_type === "business";

      const account = await stripe.accounts.create(
        {
          type: "custom",
          country: "GB",
          email,
          metadata: { operative_id: op.id },
          capabilities: {
            transfers: { requested: true },
          },
          business_type: isCompany ? "company" : "individual",
          ...(isCompany
            ? {
                company: {
                  name: (op.company_name || op.full_name || "Business").slice(0, 100),
                },
              }
            : {
                individual: {
                  email,
                  first_name: first_name.slice(0, 100),
                  last_name: last_name.slice(0, 100),
                },
              }),
          business_profile: {
            name: (op.company_name || op.full_name || "Contractor").slice(0, 100),
            mcc: "7349",
            product_description: "Cleaning and property services",
          },
          tos_acceptance: {
            date: Math.floor(Date.now() / 1000),
            ip: clientIp,
          },
          settings: {
            payouts: {
              schedule: { interval: "daily" },
            },
          },
        },
        { idempotencyKey: `operative-connect-${op.id}` }
      );

      accountId = account.id;

      const { error: saveIdErr } = await supabase
        .from("operatives")
        .update({ stripe_account_id: accountId })
        .eq("id", operativeId);
      if (saveIdErr) {
        console.error("sync-operative-bank: failed to save stripe_account_id", saveIdErr);
        return NextResponse.json(
          {
            error: "Stripe account was created but saving the account ID failed. Copy it from Stripe Connect.",
            stripe_account_id: accountId,
          },
          { status: 500 }
        );
      }
    }

    const existing = await stripe.accounts.listExternalAccounts(accountId, {
      object: "bank_account",
      limit: 10,
    });

    if (existing.data.length > 0) {
      return NextResponse.json({
        ok: true,
        already_registered: true,
        stripe_account_id: accountId,
        message:
          "This contractor already has a payout bank in Stripe. Change it in the Stripe Dashboard if needed.",
      });
    }

    await stripe.accounts.createExternalAccount(accountId, {
      external_account: {
        object: "bank_account",
        country: "GB",
        currency: "gbp",
        routing_number: sort,
        account_number: acctNum,
        account_holder_name: holder,
        account_holder_type: op.contractor_type === "business" ? "company" : "individual",
      },
    });

    return NextResponse.json({
      ok: true,
      stripe_account_id: accountId,
      message:
        "Bank account registered with Stripe. Complete any remaining verification in the Stripe Dashboard if prompted.",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Stripe sync failed";
    console.error("sync-operative-bank:", e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
