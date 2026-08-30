"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  MessageSquare,
  Plus,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Send,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getService } from "@/lib/services";
import CustomDropdown from "@/components/ui/CustomDropdown";
import {
  DISPUTE_ELIGIBLE_JOB_STATUSES,
  DISPUTE_REASON_OPTIONS,
  disputeStatusBadge,
  isDisputeResolved,
  type DisputeStatus,
} from "@/lib/dispute-helpers";

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

type EligibleJob = {
  id: string;
  reference: string;
  service_id: string;
  status: string;
  preferred_date: string | null;
};

type FilterTab = "active" | "resolved" | "all";

export default function DisputesPage() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const prefillJobId = searchParams.get("job") || "";

  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [eligibleJobs, setEligibleJobs] = useState<EligibleJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [jobId, setJobId] = useState(prefillJobId);
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
  const [filter, setFilter] = useState<FilterTab>("active");

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    setMyUserId(user.id);

    const [{ data: rows }, { data: jobs }] = await Promise.all([
      supabase
        .from("disputes")
        .select(
          `
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
        `,
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("jobs")
        .select("id, reference, service_id, status, preferred_date")
        .eq("user_id", user.id)
        .in("status", [...DISPUTE_ELIGIBLE_JOB_STATUSES])
        .order("preferred_date", { ascending: false }),
    ]);

    type Row = {
      id: string;
      job_id: string;
      status: DisputeStatus;
      reason: string;
      resolution: string | null;
      created_at: string;
      jobs: { reference: string; service_id: string } | { reference: string; service_id: string }[] | null;
    };

    const list: DisputeRow[] = ((rows as Row[]) || [])
      .map((r) => {
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

    const openJobIds = new Set(
      list.filter((d) => !isDisputeResolved(d.status)).map((d) => d.jobId),
    );
    setEligibleJobs(
      ((jobs as EligibleJob[]) || []).filter((j) => !openJobIds.has(j.id) || j.id === prefillJobId),
    );

    setLoading(false);
  }, [supabase, prefillJobId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (prefillJobId) {
      setJobId(prefillJobId);
      setShowNew(true);
    }
  }, [prefillJobId]);

  const jobOptions = useMemo(
    () =>
      eligibleJobs.map((j) => {
        const svc = getService(j.service_id)?.name || "Job";
        const date = j.preferred_date
          ? new Date(j.preferred_date.length === 10 ? `${j.preferred_date}T12:00:00` : j.preferred_date).toLocaleDateString(
              "en-GB",
              { day: "numeric", month: "short" },
            )
          : "";
        return {
          value: j.id,
          label: `${j.reference} · ${svc}${date ? ` · ${date}` : ""}`,
        };
      }),
    [eligibleJobs],
  );

  const filtered = useMemo(() => {
    if (filter === "all") return disputes;
    if (filter === "resolved") return disputes.filter((d) => isDisputeResolved(d.status));
    return disputes.filter((d) => !isDisputeResolved(d.status));
  }, [disputes, filter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!jobId || !disputeReason || description.trim().length < 10) {
      setError("Choose a job, a reason, and describe the issue (at least 10 characters).");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/disputes/open", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId,
        reasonCode: disputeReason,
        description: description.trim(),
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      error?: string;
      dispute?: DisputeRow & { serviceId?: string };
      disputeId?: string;
    };
    setSubmitting(false);
    if (!res.ok) {
      setError(json.error || "Could not open dispute");
      if (res.status === 409 && json.disputeId) {
        setExpandedId(json.disputeId);
        setShowNew(false);
      }
      return;
    }
    const d = json.dispute!;
    const svc = getService(d.serviceId || "");
    setDisputes((prev) => [
      {
        id: d.id,
        jobId: d.jobId,
        jobReference: d.jobReference,
        serviceId: d.serviceId || "",
        serviceName: svc?.name ?? "",
        status: d.status,
        reason: d.reason,
        resolution: d.resolution,
        createdAt: d.createdAt,
      },
      ...prev.filter((x) => x.id !== d.id),
    ]);
    setShowNew(false);
    setJobId("");
    setDisputeReason("");
    setDescription("");
    setFilter("active");
    setExpandedId(d.id);
    void loadMessages(d.id);
    void load();
  };

  const loadMessages = async (disputeId: string) => {
    setLoadingMessages(disputeId);
    const { data, error: msgErr } = await supabase
      .from("dispute_messages")
      .select("id, sender_id, recipient_role, message, created_at")
      .eq("dispute_id", disputeId)
      .order("created_at", { ascending: true });
    if (msgErr) console.error(msgErr);
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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setSendingId(disputeId);
    const { error: sendErr } = await supabase.from("dispute_messages").insert({
      dispute_id: disputeId,
      sender_id: user.id,
      recipient_role: "admin",
      message: text,
    });
    setSendingId(null);
    if (sendErr) {
      setError(sendErr.message);
      return;
    }
    setReplyText((prev) => ({ ...prev, [disputeId]: "" }));
    await loadMessages(disputeId);
  };

  const senderLabel = (senderId: string, uid: string | null) => (uid && senderId === uid ? "You" : "Kleen");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Disputes</h1>
          <p className="mt-1 text-sm text-slate-500">
            Raise an issue with Kleen. We mediate between you and the contractor — you never message each other directly.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowNew((v) => !v);
            setError("");
          }}
          className="btn-primary gap-2"
        >
          <Plus className="h-4 w-4" />
          New dispute
        </button>
      </div>

      {showNew && (
        <div className="card mt-6">
          <h2 className="text-lg font-semibold text-slate-900">Raise a dispute</h2>
          <p className="mt-1 text-sm text-slate-500">
            Funds stay held while Kleen reviews. Pick the job and explain what went wrong.
          </p>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <div>
              <label className="block text-sm font-medium text-slate-700">Job</label>
              {jobOptions.length === 0 ? (
                <p className="mt-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
                  No eligible jobs right now. Disputes can be opened on booked or completed jobs that don&apos;t already
                  have an open case.
                </p>
              ) : (
                <CustomDropdown
                  value={jobId}
                  onChange={setJobId}
                  options={jobOptions}
                  placeholder="Select a job"
                  className="mt-1"
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Reason</label>
              <CustomDropdown
                value={disputeReason}
                onChange={setDisputeReason}
                options={[...DISPUTE_REASON_OPTIONS]}
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
                placeholder="What happened? Include dates, rooms, or anything Kleen should know…"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="submit" disabled={submitting || jobOptions.length === 0} className="btn-primary">
                {submitting ? "Submitting…" : "Submit dispute"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNew(false);
                  setError("");
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {(
          [
            ["active", "Active"],
            ["resolved", "Resolved"],
            ["all", "All"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              filter === key
                ? "bg-brand-600 text-white shadow-sm"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {filtered.length === 0 && !showNew ? (
          <div className="card py-12 text-center">
            <AlertTriangle className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm text-slate-500">
              {filter === "active" ? "No active disputes" : filter === "resolved" ? "No resolved disputes yet" : "No disputes"}
            </p>
            <p className="text-xs text-slate-400">That&apos;s great — keep it up!</p>
          </div>
        ) : (
          filtered.map((dispute) => {
            const badge = disputeStatusBadge(dispute.status);
            const resolved = isDisputeResolved(dispute.status);
            return (
              <div key={dispute.id} className="card">
                <button
                  type="button"
                  onClick={() => toggleExpand(dispute.id)}
                  className="flex w-full items-start justify-between gap-3 text-left"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 text-slate-400">
                      {expandedId === dispute.id ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </span>
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                        resolved ? "bg-emerald-50" : "bg-amber-50"
                      }`}
                    >
                      {resolved ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        {dispute.serviceName} — {dispute.jobReference}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-sm text-slate-600">{dispute.reason}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        Opened {new Date(dispute.createdAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${badge.className}`}>
                    {badge.label}
                  </span>
                </button>

                {dispute.resolution && (
                  <div className="mt-3 rounded-lg bg-emerald-50 p-3 ring-1 ring-emerald-100">
                    <p className="flex items-start gap-2 text-xs text-emerald-900">
                      <MessageSquare className="mt-0.5 h-3 w-3 flex-shrink-0 text-emerald-600" />
                      <span>
                        <span className="font-semibold">Resolution: </span>
                        {dispute.resolution}
                      </span>
                    </p>
                  </div>
                )}

                {expandedId === dispute.id && (
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <div className="mb-3">
                      <Link
                        href={`/dashboard/jobs/${dispute.jobId}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline"
                      >
                        View job <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                    {loadingMessages === dispute.id ? (
                      <div className="flex justify-center py-3">
                        <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
                      </div>
                    ) : (
                      <>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Thread with Kleen</p>
                        <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto">
                          {(messagesByDispute[dispute.id] || []).map((m) => (
                            <li
                              key={m.id}
                              className={`rounded-lg px-3 py-2 text-sm ${
                                myUserId && m.sender_id === myUserId
                                  ? "bg-brand-50 ring-1 ring-brand-100"
                                  : "bg-slate-50 ring-1 ring-slate-100"
                              }`}
                            >
                              <p className="text-xs text-slate-500">
                                {senderLabel(m.sender_id, myUserId)} ·{" "}
                                {new Date(m.created_at).toLocaleString("en-GB")}
                              </p>
                              <p className="mt-1 whitespace-pre-wrap text-slate-700">{m.message}</p>
                            </li>
                          ))}
                          {(messagesByDispute[dispute.id] || []).length === 0 && (
                            <li className="text-sm text-slate-500">No messages yet.</li>
                          )}
                        </ul>
                        {!resolved ? (
                          <div className="mt-3 flex gap-2">
                            <textarea
                              value={replyText[dispute.id] || ""}
                              onChange={(e) =>
                                setReplyText((prev) => ({ ...prev, [dispute.id]: e.target.value }))
                              }
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
                              {sendingId === dispute.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Send className="h-4 w-4" />
                              )}
                              Send
                            </button>
                          </div>
                        ) : (
                          <p className="mt-3 text-xs text-slate-500">This dispute is closed — messaging is disabled.</p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
