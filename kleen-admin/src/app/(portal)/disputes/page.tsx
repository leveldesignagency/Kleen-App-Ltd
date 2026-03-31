"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import CustomDropdown from "@/components/ui/CustomDropdown";
import { Loader2, MessageSquare, Send } from "lucide-react";

type Row = {
  id: string;
  job_id: string;
  user_id: string;
  status: string;
  reason: string;
  created_at: string;
  jobs: { reference: string } | { reference: string }[] | null;
};

type Msg = {
  id: string;
  sender_id: string;
  recipient_role: "admin" | "customer" | "operative";
  message: string;
  created_at: string;
};

const RECIPIENT_OPTIONS = [
  { value: "customer", label: "Customer" },
  { value: "operative", label: "Contractor" },
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

  useEffect(() => {
    const run = async () => {
      const { data } = await supabase
        .from("disputes")
        .select("id, job_id, user_id, status, reason, created_at, jobs(reference)")
        .order("created_at", { ascending: false });
      setRows((data as Row[]) || []);
      setLoading(false);
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    await loadMessages(id);
  };

  const send = async () => {
    if (!activeId || !text.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
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
    setText("");
    await loadMessages(activeId);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h1 className="text-xl font-bold">Disputes</h1>
        <p className="mt-1 text-xs text-slate-400">Kleen-mediated thread between customer and contractor.</p>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-brand-400" /></div>
        ) : (
          <ul className="mt-3 space-y-2">
            {rows.map((r) => {
              const j = Array.isArray(r.jobs) ? r.jobs[0] : r.jobs;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => openDispute(r.id)}
                    className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                      activeId === r.id ? "border-brand-500/40 bg-brand-500/10" : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"
                    }`}
                  >
                    <p className="font-medium text-slate-100">{j?.reference || "Job"} · {r.status}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-400">{r.reason}</p>
                  </button>
                </li>
              );
            })}
            {rows.length === 0 && <li className="text-sm text-slate-500">No disputes.</li>}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="text-sm font-semibold text-slate-200">Thread</h2>
        {!activeId ? (
          <p className="mt-3 text-sm text-slate-500">Select a dispute.</p>
        ) : msgLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-brand-400" /></div>
        ) : (
          <>
            <ul className="mt-3 max-h-[52vh] space-y-2 overflow-y-auto">
              {messages.map((m) => (
                <li key={m.id} className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm">
                  <p className="text-xs text-slate-500">
                    {m.recipient_role === "admin" ? "To Kleen" : `To ${m.recipient_role}`} · {new Date(m.created_at).toLocaleString("en-GB")}
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
                  placeholder="Reply as Kleen..."
                />
                <button type="button" disabled={sending || !text.trim()} onClick={send} className="inline-flex h-fit items-center gap-2 self-end rounded-xl bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Send
                </button>
              </div>
            </div>
            <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
              <MessageSquare className="h-3.5 w-3.5" />
              Messages are mediated by Kleen; customer and contractor do not message each other directly.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
