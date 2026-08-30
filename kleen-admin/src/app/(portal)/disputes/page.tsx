"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import CustomDropdown from "@/components/ui/CustomDropdown";
import {
  DISPUTE_STATUS_OPTIONS,
  disputeStatusBadgeClass,
  isDisputeResolved,
} from "@/lib/dispute-helpers";
import { ExternalLink, Loader2, MessageSquare, Send } from "lucide-react";

type Row = {
  id: string;
  job_id: string;
  user_id: string;
  status: string;
  reason: string;
  resolution: string | null;
  created_at: string;
  resolved_at: string | null;
  jobs: { reference: string; status: string } | { reference: string; status: string }[] | null;
};

type Msg = {
  id: string;
  sender_id: string;
  recipient_role: "admin" | "customer" | "operative";
  message: string;
  created_at: string;
};

const RECIPIENT_OPTIONS = [
  { value: "customer", label: "Reply to customer" },
  { value: "operative", label: "Reply to contractor" },
];

const FILTER_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "all", label: "All" },
  { value: "resolved", label: "Resolved" },
];

export default function AdminDisputesPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [recipientRole, setRecipientRole] = useState("customer");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState("active");
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [statusDraft, setStatusDraft] = useState("open");
  const [resolutionDraft, setResolutionDraft] = useState("");
  const [savingMeta, setSavingMeta] = useState(false);

  const loadRows = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setMyUserId(user?.id ?? null);
    const { data } = await supabase
      .from("disputes")
      .select("id, job_id, user_id, status, reason, resolution, created_at, resolved_at, jobs(reference, status)")
      .order("created_at", { ascending: false });
    setRows((data as Row[]) || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const filteredRows = useMemo(() => {
    if (filter === "all") return rows;
    if (filter === "resolved") return rows.filter((r) => isDisputeResolved(r.status));
    return rows.filter((r) => !isDisputeResolved(r.status));
  }, [rows, filter]);

  const active = rows.find((r) => r.id === activeId) || null;

  const loadMessages = async (disputeId: string) => {
    setMsgLoading(true);
    const { data } = await supabase
      .from("dispute_messages")
      .select("id, sender_id, recipient_role, message, created_at")
      .eq("dispute_id", disputeId)
      .order("created_at", { ascending: true });
    setMessages((data as Msg[]) || []);
    setMsgLoading(false);
  };

  const openDispute = async (id: string) => {
    setActiveId(id);
    const row = rows.find((r) => r.id === id);
    setStatusDraft(row?.status || "open");
    setResolutionDraft(row?.resolution || "");
    await loadMessages(id);
  };

  const send = async () => {
    if (!activeId || !text.trim()) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setSending(true);
    const { error } = await supabase.from("dispute_messages").insert({
      dispute_id: activeId,
      sender_id: user.id,
      recipient_role: recipientRole,
      message: text.trim(),
    });
    setSending(false);
    if (error) {
      alert(error.message);
      return;
    }
    // Move open → under_review on first admin reply
    if (active && active.status === "open") {
      await supabase.from("disputes").update({ status: "under_review" }).eq("id", activeId);
      setStatusDraft("under_review");
      void loadRows();
    }
    setText("");
    await loadMessages(activeId);
  };

  const saveMeta = async () => {
    if (!activeId || !active) return;
    setSavingMeta(true);
    const res = await fetch("/api/disputes/update", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        disputeId: activeId,
        status: statusDraft,
        resolution: resolutionDraft.trim() || null,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setSavingMeta(false);
    if (!res.ok) {
      alert(json.error || "Could not save");
      return;
    }
    await loadRows();
  };

  const msgLabel = (m: Msg) => {
    const fromAdmin = myUserId && m.sender_id === myUserId;
    if (fromAdmin) {
      return m.recipient_role === "customer"
        ? "Kleen → Customer"
        : m.recipient_role === "operative"
          ? "Kleen → Contractor"
          : "Kleen";
    }
    if (m.recipient_role === "admin") {
      // Could be customer or contractor — we don't store sender role; infer later if needed
      return "Party → Kleen";
    }
    return `To ${m.recipient_role}`;
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold">Disputes</h1>
            <p className="mt-1 text-xs text-slate-400">Mediated thread — customer and contractor never chat directly.</p>
          </div>
        </div>
        <div className="mt-3">
          <CustomDropdown value={filter} onChange={setFilter} options={FILTER_OPTIONS} />
        </div>
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-brand-400" />
          </div>
        ) : (
          <ul className="mt-3 max-h-[70vh] space-y-2 overflow-y-auto">
            {filteredRows.map((r) => {
              const j = Array.isArray(r.jobs) ? r.jobs[0] : r.jobs;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => openDispute(r.id)}
                    className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                      activeId === r.id
                        ? "border-brand-500/40 bg-brand-500/10"
                        : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-slate-100">{j?.reference || "Job"}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${disputeStatusBadgeClass(r.status)}`}>
                        {r.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-400">{r.reason}</p>
                    <p className="mt-1 text-[10px] text-slate-500">
                      {new Date(r.created_at).toLocaleString("en-GB")}
                    </p>
                  </button>
                </li>
              );
            })}
            {filteredRows.length === 0 && <li className="text-sm text-slate-500">No disputes in this filter.</li>}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        {!activeId || !active ? (
          <p className="mt-3 text-sm text-slate-500">Select a dispute to mediate.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-4">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-slate-200">
                  {(Array.isArray(active.jobs) ? active.jobs[0] : active.jobs)?.reference || "Job"}
                </h2>
                <p className="mt-1 text-sm text-slate-400">{active.reason}</p>
                <Link
                  href={`/jobs/${active.job_id}`}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-400 hover:underline"
                >
                  Open job <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </div>

            <div className="mt-4 grid gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-slate-400">Status</label>
                <CustomDropdown
                  className="mt-1"
                  value={statusDraft}
                  onChange={setStatusDraft}
                  options={[...DISPUTE_STATUS_OPTIONS]}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-slate-400">Resolution note</label>
                <textarea
                  value={resolutionDraft}
                  onChange={(e) => setResolutionDraft(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-brand-500"
                  placeholder="Shown to customer & contractor when resolved…"
                />
              </div>
              <button
                type="button"
                disabled={savingMeta}
                onClick={saveMeta}
                className="inline-flex items-center justify-center rounded-xl bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/15 disabled:opacity-50 sm:col-span-2"
              >
                {savingMeta ? "Saving…" : "Save status / resolution"}
              </button>
            </div>

            <h3 className="mt-5 text-sm font-semibold text-slate-200">Thread</h3>
            {msgLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-brand-400" />
              </div>
            ) : (
              <>
                <ul className="mt-3 max-h-[40vh] space-y-2 overflow-y-auto">
                  {messages.map((m) => (
                    <li key={m.id} className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm">
                      <p className="text-xs text-slate-500">
                        {msgLabel(m)} · {new Date(m.created_at).toLocaleString("en-GB")}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-slate-200">{m.message}</p>
                    </li>
                  ))}
                  {messages.length === 0 && <li className="text-sm text-slate-500">No messages.</li>}
                </ul>
                <div className="mt-4 grid gap-2 sm:grid-cols-[220px_minmax(0,1fr)]">
                  <CustomDropdown value={recipientRole} onChange={setRecipientRole} options={RECIPIENT_OPTIONS} />
                  <div className="flex gap-2">
                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      rows={2}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-brand-500"
                      placeholder="Reply as Kleen…"
                    />
                    <button
                      type="button"
                      disabled={sending || !text.trim()}
                      onClick={send}
                      className="inline-flex h-fit items-center gap-2 self-end rounded-xl bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
                    >
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Send
                    </button>
                  </div>
                </div>
                <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Customer only sees messages to them; contractor only sees messages to them.
                </p>
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}
