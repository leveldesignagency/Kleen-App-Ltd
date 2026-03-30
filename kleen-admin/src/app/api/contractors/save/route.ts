import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAdminApi } from "@/lib/require-admin-api";

type OperativeServicePayload = {
  id?: string;
  service_id: string;
  contract_title?: string | null;
  contract_content?: string | null;
  contract_content_preview?: string | null;
  contract_file_url?: string | null;
};

type OperativePayload = {
  full_name: string;
  email: string;
  phone?: string | null;
  contractor_type?: string;
  company_name?: string | null;
  specialisations?: string[];
  service_areas?: string[];
  hourly_rate?: number | null;
  is_active?: boolean;
  is_verified?: boolean;
  notes?: string | null;
  bank_account_name?: string | null;
  bank_sort_code?: string | null;
  bank_account_number?: string | null;
  company_number?: string | null;
  vat_number?: string | null;
  utr_number?: string | null;
  trading_name?: string | null;
  registered_address?: string | null;
};

function buildOperativeUpdatePayload(data: OperativePayload) {
  return {
    full_name: data.full_name,
    email: data.email,
    phone: data.phone || null,
    contractor_type: data.contractor_type || "sole_trader",
    company_name: data.company_name || null,
    specialisations: data.specialisations ?? [],
    service_areas: data.service_areas ?? [],
    hourly_rate: data.hourly_rate ?? null,
    is_active: data.is_active ?? true,
    is_verified: data.is_verified ?? false,
    notes: data.notes || null,
    bank_account_name: data.bank_account_name?.trim() || null,
    bank_sort_code: data.bank_sort_code?.replace(/\D/g, "").slice(0, 6) || null,
    bank_account_number: data.bank_account_number?.replace(/\D/g, "").slice(0, 8) || null,
    company_number: data.company_number?.trim() || null,
    vat_number: data.vat_number?.trim() || null,
    utr_number: data.utr_number?.replace(/\D/g, "").slice(0, 10) || null,
    trading_name: data.trading_name?.trim() || null,
    registered_address: data.registered_address?.trim() || null,
  };
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { mode, id, operative, operative_services } = body as {
      mode: "add" | "edit";
      id?: string;
      operative: OperativePayload;
      operative_services?: OperativeServicePayload[];
    };

    if (!operative?.full_name?.trim() || !operative?.email?.trim()) {
      return NextResponse.json({ error: "Full name and email are required" }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    const payload = buildOperativeUpdatePayload(operative);
    const osList: OperativeServicePayload[] = Array.isArray(operative_services) ? operative_services : [];

    if (mode === "add") {
      const { data: inserted, error } = await supabase.from("operatives").insert(payload).select("*").single();
      if (error) {
        console.error("contractors/save insert:", error);
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      for (const row of osList) {
        const ins = await supabase.from("operative_services").insert({
          operative_id: inserted.id,
          service_id: row.service_id,
          contract_title: row.contract_title || null,
          contract_content: row.contract_content || null,
          contract_content_preview: row.contract_content_preview?.trim() || null,
          contract_file_url: row.contract_file_url || null,
          is_active: true,
        });
        if (ins.error) {
          console.error("contractors/save operative_services insert:", ins.error);
          return NextResponse.json({ error: ins.error.message }, { status: 400 });
        }
      }
      return NextResponse.json({ ok: true, operative: inserted });
    }

    if (mode === "edit") {
      if (!id) {
        return NextResponse.json({ error: "Missing contractor id" }, { status: 400 });
      }
      const { data: updated, error } = await supabase
        .from("operatives")
        .update(payload)
        .eq("id", id)
        .select("*")
        .single();
      if (error) {
        console.error("contractors/save update:", error);
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      const currentIds = osList.filter((r) => r.id).map((r) => r.id as string);
      const { data: existingRows } = await supabase.from("operative_services").select("id").eq("operative_id", id);
      const existingDbIds = (existingRows || []).map((r: { id: string }) => r.id);
      const toDelete = existingDbIds.filter((dbId) => !currentIds.includes(dbId));
      for (const rowId of toDelete) {
        await supabase.from("operative_services").delete().eq("id", rowId);
      }
      for (const row of osList) {
        const rowPayload = {
          operative_id: id,
          service_id: row.service_id,
          contract_title: row.contract_title || null,
          contract_content: row.contract_content || null,
          contract_content_preview: row.contract_content_preview?.trim() || null,
          contract_file_url: row.contract_file_url || null,
          is_active: true,
        };
        if (row.id) {
          const u = await supabase.from("operative_services").update(rowPayload).eq("id", row.id);
          if (u.error) {
            console.error("contractors/save operative_services update:", u.error);
            return NextResponse.json({ error: u.error.message }, { status: 400 });
          }
        } else {
          const ins = await supabase.from("operative_services").insert(rowPayload);
          if (ins.error) {
            console.error("contractors/save operative_services insert:", ins.error);
            return NextResponse.json({ error: ins.error.message }, { status: 400 });
          }
        }
      }

      return NextResponse.json({ ok: true, operative: updated });
    }

    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  } catch (e) {
    console.error("contractors/save:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Save failed" },
      { status: 500 }
    );
  }
}
