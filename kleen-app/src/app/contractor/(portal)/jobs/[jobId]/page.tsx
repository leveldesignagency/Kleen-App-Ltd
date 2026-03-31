"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useContractorPortal } from "@/components/contractor/contractor-portal-context";
import CustomDropdown from "@/components/ui/CustomDropdown";
import { Loader2 } from "lucide-react";

type ReportStage = "pre_job" | "post_job" | "cannot_start";
type Outcome = "in_progress" | "completed" | "not_completed";

type JobRow = {
  id: string;
  reference: string;
  status: string;
  address_line_1: string;
  city: string | null;
  postcode: string;
  preferred_date: string;
};

type ReportItem = {
  id: string;
  item_type: string;
  note: string;
  photo_urls: string[];
  created_at: string;
};

type ReportRow = {
  id: string;
  stage: ReportStage;
  job_outcome: Outcome | null;
  summary: string | null;
  submitted_at: string;
  job_report_items: ReportItem[] | null;
};

const STAGE_OPTIONS = [
  { value: "pre_job", label: "Pre-job inspection" },
  { value: "post_job", label: "Post-job report" },
  { value: "cannot_start", label: "Could not start job" },
];

const ITEM_TYPE_OPTIONS = [
  { value: "damage", label: "Damage (pre-existing)" },
  { value: "obstruction", label: "Obstruction / access issue" },
  { value: "note", label: "General note" },
  { value: "completion_note", label: "Completion note" },
];

const OUTCOME_OPTIONS = [
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "not_completed", label: "Not completed" },
];

export default function ContractorJobLayoutPage() {
  const params = useParams<{ jobId: string }>();
  const jobId = params?.jobId;
  const router = useRouter();
  const { operativeId, isVerified } = useContractorPortal();
  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState<JobRow | null>(null);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [savingReport, setSavingReport] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [stage, setStage] = useState<ReportStage>("pre_job");
  const [summary, setSummary] = useState("");
  const [outcome, setOutcome] = useState<Outcome>("in_progress");
  const [itemType, setItemType] = useState("damage");
  const [note, setNote] = useState("");
  const [photoUrlsRaw, setPhotoUrlsRaw] = useState("");

  const reportByStage = useMemo(
    () => ({
      pre_job: reports.find((r) => r.stage === "pre_job"),
      post_job: reports.find((r) => r.stage === "post_job"),
      cannot_start: reports.find((r) => r.stage === "cannot_start"),
    }),
    [reports]
  );

  const load = useCallback(async () => {
    if (!jobId || !operativeId || !isVerified) return;
    const supabase = createClient();

    const { data: assignment, error: assignErr } = await supabase
      .from("job_assignments")
      .select("job_id")
      .eq("job_id", jobId)
      .eq("operative_id", operativeId)
      .maybeSingle();
    if (assignErr || !assignment) {
      router.replace("/contractor/jobs");
      return;
    }

    const [{ data: jobData }, { data: reportData }] = await Promise.all([
      supabase
        .from("jobs")
        .select("id, reference, status, address_line_1, city, postcode, preferred_date")
        .eq("id", jobId)
        .single(),
      supabase
        .from("job_reports")
        .select("id, stage, job_outcome, summary, submitted_at, job_report_items(id, item_type, note, photo_urls, created_at)")
        .eq("job_id", jobId)
        .eq("operative_id", operativeId)
        .order("submitted_at", { ascending: false }),
    ]);

    setJob((jobData as JobRow) || null);
    setReports((reportData as unknown as ReportRow[]) || []);
    setLoading(false);
  }, [jobId, operativeId, isVerified, router]);

  useEffect(() => {
    if (!isVerified) router.replace("/contractor");
  }, [isVerified, router]);

  useEffect(() => {
    if (!isVerified) return;
    setLoading(true);
    load();
  }, [load, isVerified]);

  const saveReport = async () => {
    if (!jobId || !operativeId) return;
    setSavingReport(true);
    const supabase = createClient();
    const payload = {
      job_id: jobId,
      operative_id: operativeId,
      stage,
      summary: summary.trim() || null,
      job_outcome: stage === "pre_job" ? "in_progress" : outcome,
      submitted_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("job_reports")
      .upsert(payload, { onConflict: "job_id,operative_id,stage" });
    setSavingReport(false);
    if (error) {
      alert(error.message);
      return;
    }
    await load();
  };

  const addItem = async () => {
    if (!note.trim() || !jobId || !operativeId) return;
    setSavingItem(true);
    const supabase = createClient();
    const existing = reportByStage[stage];
    let reportId = existing?.id || null;
    if (!reportId) {
      const { data: created, error: createErr } = await supabase
        .from("job_reports")
        .insert({
          job_id: jobId,
          operative_id: operativeId,
          stage,
          job_outcome: stage === "pre_job" ? "in_progress" : outcome,
          summary: summary.trim() || null,
        })
        .select("id")
        .single();
      if (createErr || !created) {
        setSavingItem(false);
        alert(createErr?.message || "Could not create report");
        return;
      }
      reportId = created.id;
    }
    const photo_urls = photoUrlsRaw
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const { error } = await supabase.from("job_report_items").insert({
      report_id: reportId,
      item_type: itemType,
      note: note.trim(),
      photo_urls,
    });
    setSavingItem(false);
    if (error) {
      alert(error.message);
      return;
    }
    setNote("");
    setPhotoUrlsRaw("");
    await load();
  };

  if (!isVerified || loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (!job) return null;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/contractor/jobs" className="text-xs font-medium text-brand-600 hover:underline">
          Back to jobs
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Job layout</h1>
        <p className="mt-1 text-sm text-slate-600">
          {job.reference} · {job.address_line_1}
          {job.city ? `, ${job.city}` : ""} · {job.postcode}
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Create / update report</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs text-slate-500">Report stage</label>
            <CustomDropdown
              className="mt-1"
              value={stage}
              onChange={(v) => setStage(v as ReportStage)}
              options={STAGE_OPTIONS}
            />
          </div>
          {stage !== "pre_job" && (
            <div>
              <label className="text-xs text-slate-500">Job outcome</label>
              <CustomDropdown
                className="mt-1"
                value={outcome}
                onChange={(v) => setOutcome(v as Outcome)}
                options={OUTCOME_OPTIONS}
              />
            </div>
          )}
        </div>
        <label className="mt-3 block text-xs text-slate-500">
          Summary for this stage
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            className="input-field mt-1"
            placeholder="Short summary of findings / work outcome"
          />
        </label>
        <button
          type="button"
          disabled={savingReport}
          onClick={saveReport}
          className="btn-primary mt-3"
        >
          {savingReport ? "Saving…" : "Save report stage"}
        </button>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Add evidence note</h2>
        <p className="mt-1 text-xs text-slate-500">
          Add notes/photos for damages, obstructions, and post-job evidence to support future dispute review.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs text-slate-500">Evidence type</label>
            <CustomDropdown className="mt-1" value={itemType} onChange={setItemType} options={ITEM_TYPE_OPTIONS} />
          </div>
          <div>
            <label className="text-xs text-slate-500">Linked stage</label>
            <CustomDropdown className="mt-1" value={stage} onChange={(v) => setStage(v as ReportStage)} options={STAGE_OPTIONS} />
          </div>
        </div>
        <label className="mt-3 block text-xs text-slate-500">
          Note
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="input-field mt-1"
            placeholder="What did you find before starting, or what prevented completion?"
          />
        </label>
        <label className="mt-3 block text-xs text-slate-500">
          Photo URLs (one per line)
          <textarea
            value={photoUrlsRaw}
            onChange={(e) => setPhotoUrlsRaw(e.target.value)}
            rows={3}
            className="input-field mt-1"
            placeholder="https://..."
          />
        </label>
        <button type="button" disabled={savingItem || !note.trim()} onClick={addItem} className="btn-primary mt-3">
          {savingItem ? "Adding…" : "Add evidence"}
        </button>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Report timeline</h2>
        <ul className="mt-3 space-y-4">
          {reports.map((r) => (
            <li key={r.id} className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm font-medium text-slate-900">
                {STAGE_OPTIONS.find((o) => o.value === r.stage)?.label || r.stage}
                {r.job_outcome ? ` · ${r.job_outcome.replace("_", " ")}` : ""}
              </p>
              <p className="mt-1 text-xs text-slate-500">{new Date(r.submitted_at).toLocaleString("en-GB")}</p>
              {r.summary && <p className="mt-2 text-sm text-slate-700">{r.summary}</p>}
              <ul className="mt-2 space-y-2">
                {(r.job_report_items || []).map((i) => (
                  <li key={i.id} className="rounded-lg bg-slate-50 p-2 text-sm">
                    <p className="font-medium text-slate-800">{i.item_type.replace("_", " ")}</p>
                    <p className="mt-1 text-slate-700">{i.note}</p>
                    {i.photo_urls?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {i.photo_urls.map((u) => (
                          <a key={u} href={u} target="_blank" rel="noreferrer" className="text-xs text-brand-600 underline">
                            photo
                          </a>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
          {reports.length === 0 && <li className="text-sm text-slate-500">No reports yet.</li>}
        </ul>
      </section>
    </div>
  );
}
