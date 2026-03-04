"use client";

import { useState } from "react";
import { AlertTriangle, MessageSquare, Plus, Clock, CheckCircle2 } from "lucide-react";
import CustomDropdown from "@/components/ui/CustomDropdown";

/* TODO: replace with Supabase query */
const MOCK_DISPUTES: { id: string; jobId: string; service: string; status: "open" | "resolved"; reason: string; date: string; resolution?: string }[] = [];

const DISPUTE_REASON_OPTIONS = [
  { value: "quality", label: "Quality not satisfactory" },
  { value: "missed", label: "Areas missed" },
  { value: "damage", label: "Property damage" },
  { value: "noshow", label: "Cleaner did not arrive" },
  { value: "pricing", label: "Pricing dispute" },
  { value: "other", label: "Other" },
];

export default function DisputesPage() {
  const [showNew, setShowNew] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");

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
          <form className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Job Reference</label>
              <input type="text" className="input-field mt-1" placeholder="e.g. JOB-001" />
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
              <textarea className="input-field mt-1 min-h-[100px] resize-y" placeholder="Please describe the issue..." />
            </div>
            <div className="flex gap-3">
              <button type="submit" className="btn-primary">
                Submit Dispute
              </button>
              <button type="button" onClick={() => setShowNew(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {MOCK_DISPUTES.length === 0 && !showNew ? (
          <div className="card py-12 text-center">
            <AlertTriangle className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm text-slate-500">No disputes</p>
            <p className="text-xs text-slate-400">That&apos;s great — keep it up!</p>
          </div>
        ) : (
          MOCK_DISPUTES.map((dispute) => (
            <div key={dispute.id} className="card">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                    dispute.status === "resolved" ? "bg-accent-50" : "bg-amber-50"
                  }`}>
                    {dispute.status === "resolved" ? (
                      <CheckCircle2 className="h-4 w-4 text-accent-600" />
                    ) : (
                      <Clock className="h-4 w-4 text-amber-600" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {dispute.service} — {dispute.reason}
                    </p>
                    <p className="text-xs text-slate-400">
                      {dispute.id} &middot; {dispute.jobId} &middot;{" "}
                      {new Date(dispute.date).toLocaleDateString("en-GB")}
                    </p>
                  </div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    dispute.status === "resolved"
                      ? "bg-accent-100 text-accent-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {dispute.status === "resolved" ? "Resolved" : "Open"}
                </span>
              </div>
              {dispute.resolution && (
                <div className="mt-3 rounded-lg bg-slate-50 p-3">
                  <p className="flex items-start gap-2 text-xs text-slate-600">
                    <MessageSquare className="mt-0.5 h-3 w-3 flex-shrink-0 text-slate-400" />
                    {dispute.resolution}
                  </p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
