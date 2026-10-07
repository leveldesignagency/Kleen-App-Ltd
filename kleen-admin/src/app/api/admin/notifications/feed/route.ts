import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAdminApi } from "@/lib/require-admin-api";

export type AdminFeedItem = {
  id: string;
  kind: "job" | "contractor_signup" | "contractor_review" | "dispute";
  title: string;
  message: string;
  href: string;
  createdAt: string;
};

/** Poll recent admin-notification events (fallback when Realtime is unavailable). */
export async function GET(request: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const sinceParam = request.nextUrl.searchParams.get("since");
  const since = sinceParam ? new Date(sinceParam) : new Date(Date.now() - 15 * 60 * 1000);
  if (Number.isNaN(since.getTime())) {
    return NextResponse.json({ error: "Invalid since" }, { status: 400 });
  }
  const sinceIso = since.toISOString();

  let admin;
  try {
    admin = createServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server misconfigured";
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  const items: AdminFeedItem[] = [];

  const { data: jobs } = await admin
    .from("jobs")
    .select("id, reference, created_at")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(25);

  for (const job of jobs ?? []) {
    items.push({
      id: `job:${job.id}`,
      kind: "job",
      title: "New job submitted",
      message: job.reference
        ? `${job.reference} is waiting in the queue.`
        : "A customer has submitted a new booking.",
      href: `/jobs/${job.id}`,
      createdAt: job.created_at,
    });
  }

  const { data: operatives } = await admin
    .from("operatives")
    .select("id, full_name, email, is_verified, submitted_for_review_at, created_at, updated_at, user_id")
    .or(`created_at.gte.${sinceIso},updated_at.gte.${sinceIso}`)
    .order("updated_at", { ascending: false })
    .limit(40);

  for (const op of operatives ?? []) {
    if (op.is_verified) continue;
    const name = op.full_name?.trim() || op.email || "Contractor";
    if (op.submitted_for_review_at && op.submitted_for_review_at >= sinceIso) {
      items.push({
        id: `contractor-review:${op.id}:${op.submitted_for_review_at}`,
        kind: "contractor_review",
        title: "Contractor submitted for review",
        message: `${name} — review in Contractors.`,
        href: `/contractors/${op.id}`,
        createdAt: op.submitted_for_review_at,
      });
    } else if (op.user_id && op.created_at && op.created_at >= sinceIso) {
      items.push({
        id: `contractor-signup:${op.id}`,
        kind: "contractor_signup",
        title: "New contractor signed up",
        message: `${name} — review in Contractors.`,
        href: `/contractors/${op.id}`,
        createdAt: op.created_at,
      });
    }
  }

  const { data: disputes } = await admin
    .from("disputes")
    .select("id, job_id, created_at, status")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(20);

  for (const d of disputes ?? []) {
    items.push({
      id: `dispute:${d.id}`,
      kind: "dispute",
      title: "New dispute opened",
      message: "A customer opened a dispute — review in Disputes.",
      href: `/disputes`,
      createdAt: d.created_at,
    });
  }

  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json({ items, since: sinceIso });
}
