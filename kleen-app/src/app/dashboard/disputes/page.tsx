"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, MessageSquare, Plus, Clock, CheckCircle2, ChevronDown, ChevronRight, Send, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getService } from "@/lib/services";
import CustomDropdown from "@/components/ui/CustomDropdown";

const DISPUTE_REASON_OPTIONS = [
  { value: "quality", label: "Quality not satisfactory" },
  { value: "missed", label: "Areas missed" },
  { value: "damage", label: "Property damage" },
  { value: "noshow", label: "Cleaner did not arrive" },
  { value: "pricing", label: "Pricing dispute" },
  { value: "other", label: "Other" },
];

type DisputeStatus = "open" | "under_review" | "resolved" | "escalated" | "closed";

interface DisputeRow {
  id: string;
  jobId: string;
  jobReference: string;
  serviceId: string;
  serviceName: string;
  status: DisputeStatus;
  reason: string;
  resolution: string | null;
  createdAt: string;
}

type MsgRow = {
  id: string;
  sender_id: string;
  recipient_role: "admin" | "customer" | "operative";
  message: string;
  created_at: string;
};

export default function DisputesPage() {
  const supabase = createClient();
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [jobReference, setJobReference] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [messagesByDispute, setMessagesByDispute] = useState<Record<string, MsgRow[]>>({});
  const [loadingMessages, setLoadingMessages] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setMyUserId(user.id);
      const { data: rows } = await supabase
        .from("disputes")
        .select(`
          id,
          job_id,
          status,
          reason,
          resolution,
          created_at,
          jobs (
            reference,
            service_id
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (!rows) {
        setLoading(false);
        return;
      }
      type Row = {
        id: string;
        job_id: string;
        status: DisputeStatus;
        reason: string;
        resolution: string | null;
        created_at: string;
        jobs: { reference: string; service_id: string } | { reference: string; service_id: string }[] | null;
      };
      const list: DisputeRow[] = rows
        .filter((r: Row) => r.jobs != null)
        .map((r: Row) => {
          const job = Array.isArray(r.jobs) ? r.jobs[0] : r.jobs;
          if (!job) return null;
          const svc = getService(job.service_id);
          return {
            id: r.id,
            jobId: r.job_id,
            jobReference: job.reference,
            serviceId: job.service_id,
            serviceName: svc?.name ?? job.service_id,
            status: r.status,
            reason: r.reason,
            resolution: r.resolution,
            createdAt: r.created_at,
          };
        })
        .filter((row): row is DisputeRow => row != null);
      setDisputes(list);
      setLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!jobReference.trim() || !disputeReason.trim() || !description.trim()) {
      setError("Please fill in job reference, reason, and description.");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSubmitting(true);
    const { data: job } = await supabase
      .from("jobs")
      .select("id, reference, service_id")
      .eq("reference", jobReference.trim().toUpperCase())
      .eq("user_id", user.id)
      .maybeSingle();
    if (!job) {
      setError("Job not found. Check the reference and try again.");
      setSubmitting(false);
      return;
    }
    const reasonLabel = DISPUTE_REASON_OPTIONS.find((o) => o.value === disputeReason)?.label ?? disputeReason;
    const reasonText = `${reasonLabel}: ${description.trim()}`;
    const { data: newRow, error: insertErr } = await supabase
      .from("disputes")
      .insert({
        job_id: job.id,
        user_id: user.id,
        reason: reasonText,
      })
      .select("id, job_id, status, reason, resolution, created_at")
      .single();
    if (insertErr) {
      setError(insertErr.message);
      setSubmitting(false);
      return;
    }
    const svc = getService(job.service_id);
    setDisputes((prev) => [
      {
        id: newRow.id,
        jobId: newRow.job_id,
        jobReference: job.reference,
        serviceId: job.service_id,
        serviceName: svc?.name ?? "",
        status: newRow.status,
        reason: newRow.reason,
        resolution: newRow.resolution,
        createdAt: newRow.created_at,
      },
      ...prev,
    ]);
    setShowNew(false);
    setJobReference("");
    setDisputeReason("");
    setDescription("");
    setSubmitting(false);
  };

  const isResolved = (s: DisputeStatus) => s === "resolved" || s === "closed";
  const senderLabel = (senderId: string, uid: string | null) => (uid && senderId === uid ? "You" : "Kleen");

  const loadMessages = async (disputeId: string) => {
    setLoadingMessages(disputeId);
    const { data, error } = await supabase
      .from("dispute_messages")
      .select("id, sender_id, recipient_role, message, created_at")
      .eq("dispute_id", disputeId)
      .order("created_at", { ascending: true });
    if (error) console.error(error);
    setMessagesByDispute((prev) => ({ ...prev, [disputeId]: (data as MsgRow[]) || [] }));
    setLoadingMessages(null);
  };

  const toggleExpand = (disputeId: string) => {
    if (expandedId === disputeId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(disputeId);
    if (!messagesByDispute[disputeId]) void loadMessages(disputeId);
  };

  const sendReply = async (disputeId: string) => {
    const text = (replyText[disputeId] || "").trim();
    if (!text) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSendingId(disputeId);
    const { error } = await supabase.from("dispute_messages").insert({
      dispute_id: disputeId,
      sender_id: user.id,
      recipient_role: "admin",
      message: text,
    });
    setSendingId(null);
    if (error) {
      setError(error.message);
      return;
    }
    setReplyText((prev) => ({ ...prev, [disputeId]: "" }));
    await loadMessages(disputeId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Disputes</h1>
          <p className="mt-1 text-sm text-slate-500">Raise and track disputes for your jobs</p>
        </div>
        <button onClick={() => setShowNew(!showNew)} className="btn-primary gap-2">
          <Plus className="h-4 w-4" />
          New Dispute
        </button>
      </div>

      {showNew && (
        <div className="card mt-6">
          <h2 className="text-lg font-semibold text-slate-900">Raise a Dispute</h2>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {error && (
              <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700">Job Reference</label>
              <input
                type="text"
                value={jobReference}
                onChange={(e) => setJobReference(e.target.value.toUpperCase())}
                className="input-field mt-1"
                placeholder="e.g. KLN-7A3F"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Reason</label>
              <CustomDropdown
                value={disputeReason}
                onChange={setDisputeReason}
                options={DISPUTE_REASON_OPTIONS}
                placeholder="Select a reason"
                className="mt-1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input-field mt-1 min-h-[100px] resize-y"
                placeholder="Please describe the issue..."
              />
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? "Submitting…" : "Submit Dispute"}
              </button>
              <button type="button" onClick={() => setShowNew(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {disputes.length === 0 && !showNew ? (
          <div className="card py-12 text-center">
            <AlertTriangle className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm text-slate-500">No disputes</p>
            <p className="text-xs text-slate-400">That&apos;s great — keep it up!</p>
          </div>
        ) : (
          disputes.map((dispute) => (
            <div key={dispute.id} className="card">
              <button
                type="button"
                onClick={() => toggleExpand(dispute.id)}
                className="flex w-full items-start justify-between gap-3 text-left"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 text-slate-400">
                    {expandedId === dispute.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </span>
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                    isResolved(dispute.status) ? "bg-accent-50" : "bg-amber-50"
                  }`}>
                    {isResolved(dispute.status) ? (
                      <CheckCircle2 className="h-4 w-4 text-accent-600" />
                    ) : (
                      <Clock className="h-4 w-4 text-amber-600" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {dispute.serviceName} — {dispute.reason}
                    </p>
                    <p className="text-xs text-slate-400">
                      {dispute.jobReference} &middot;{" "}
                      {new Date(dispute.createdAt).toLocaleDateString("en-GB")}
                    </p>
                  </div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    isResolved(dispute.status)
                      ? "bg-accent-100 text-accent-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {dispute.status === "resolved" || dispute.status === "closed" ? "Resolved" : dispute.status.replace("_", " ")}
                </span>
              </button>
              {dispute.resolution && (
                <div className="mt-3 rounded-lg bg-slate-50 p-3">
                  <p className="flex items-start gap-2 text-xs text-slate-600">
                    <MessageSquare className="mt-0.5 h-3 w-3 flex-shrink-0 text-slate-400" />
                    {dispute.resolution}
                  </p>
                </div>
              )}
              {expandedId === dispute.id && (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  {loadingMessages === dispute.id ? (
                    <div className="flex justify-center py-3">
                      <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
                    </div>
                  ) : (
                    <>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Thread with Kleen</p>
                      <ul className="mt-3 space-y-2">
                        {(messagesByDispute[dispute.id] || []).map((m) => (
                          <li key={m.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                            <p className="text-xs text-slate-500">
                              {senderLabel(m.sender_id, myUserId)} · {new Date(m.created_at).toLocaleString("en-GB")}
                            </p>
                            <p className="mt-1 whitespace-pre-wrap text-slate-700">{m.message}</p>
                          </li>
                        ))}
                        {(messagesByDispute[dispute.id] || []).length === 0 && (
                          <li className="text-sm text-slate-500">No messages yet.</li>
                        )}
                      </ul>
                      <div className="mt-3 flex gap-2">
                        <textarea
                          value={replyText[dispute.id] || ""}
                          onChange={(e) => setReplyText((prev) => ({ ...prev, [dispute.id]: e.target.value }))}
                          className="input-field min-h-[72px] flex-1 resize-y"
                          placeholder="Message Kleen about this dispute…"
                          rows={2}
                        />
                        <button
                          type="button"
                          disabled={sendingId === dispute.id || !(replyText[dispute.id] || "").trim()}
                          onClick={() => sendReply(dispute.id)}
                          className="btn-primary h-fit self-end gap-2"
                        >
                          {sendingId === dispute.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          Send
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
