import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Remove contractor ID documents from storage when retain-until has passed
 * and no legal hold applies. Leaves operative ledger row (anonymised contact).
 */
export async function purgeDueContractorDocuments(
  supabase: SupabaseClient,
): Promise<{ purged: number; skippedHold: number; errors: string[] }> {
  const today = new Date().toISOString().slice(0, 10);
  const { data: due, error } = await supabase
    .from("operatives")
    .select("id, id_document_storage_path, documents_retain_until")
    .is("documents_purged_at", null)
    .not("documents_retain_until", "is", null)
    .lte("documents_retain_until", today);

  if (error) {
    return { purged: 0, skippedHold: 0, errors: [error.message] };
  }

  let purged = 0;
  let skippedHold = 0;
  const errors: string[] = [];

  for (const op of due || []) {
    const { data: holds } = await supabase
      .from("legal_holds")
      .select("id")
      .eq("subject_type", "operative")
      .eq("subject_id", op.id)
      .is("released_at", null)
      .limit(1);

    if (holds?.length) {
      skippedHold += 1;
      await supabase
        .from("operatives")
        .update({ documents_purge_blocked_reason: "active_legal_hold" })
        .eq("id", op.id);
      continue;
    }

    const paths: string[] = [];
    if (op.id_document_storage_path) paths.push(op.id_document_storage_path);

    const { data: personnel } = await supabase
      .from("operative_personnel")
      .select("id, id_document_storage_path")
      .eq("operative_id", op.id);

    for (const p of personnel || []) {
      if (p.id_document_storage_path) paths.push(p.id_document_storage_path);
    }

    if (paths.length > 0) {
      const { error: rmErr } = await supabase.storage.from("contractor-documents").remove(paths);
      if (rmErr) {
        errors.push(`${op.id}: ${rmErr.message}`);
        continue;
      }
    }

    const now = new Date().toISOString();
    await supabase
      .from("operative_personnel")
      .update({ id_document_storage_path: null, id_document_uploaded_at: null })
      .eq("operative_id", op.id);

    await supabase
      .from("operatives")
      .update({
        id_document_storage_path: null,
        id_document_uploaded_at: null,
        documents_purged_at: now,
        documents_purge_blocked_reason: null,
      })
      .eq("id", op.id);

    purged += 1;
  }

  return { purged, skippedHold, errors };
}
