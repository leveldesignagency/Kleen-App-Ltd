"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAdminNotifications } from "@/lib/admin-notifications";
import {
  Search,
  Users,
  Loader2,
  Ban,
  ShieldCheck,
  X,
  Mail,
  Calendar,
  AlertTriangle,
} from "lucide-react";

interface Customer {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  account_type: string;
  is_blocked: boolean;
  created_at: string;
  job_count: number;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [confirmTarget, setConfirmTarget] = useState<Customer | null>(null);
  const [processing, setProcessing] = useState(false);
  const toast = useAdminNotifications((s) => s.push);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("profiles")
        .select("id, email, full_name, phone, account_type, is_blocked, created_at")
        .neq("role", "admin")
        .order("created_at", { ascending: false });

      if (data) {
        const customerIds = data.map((p) => p.id);
        const { data: jobCounts } = await supabase
          .from("jobs")
          .select("user_id")
          .in("user_id", customerIds);

        const countMap: Record<string, number> = {};
        jobCounts?.forEach((j: { user_id: string }) => {
          countMap[j.user_id] = (countMap[j.user_id] || 0) + 1;
        });

        setCustomers(
          data.map((p) => ({
            id: p.id,
            email: p.email || "",
            full_name: p.full_name || "",
            phone: p.phone || "",
            account_type: p.account_type || "personal",
            is_blocked: p.is_blocked || false,
            created_at: p.created_at,
            job_count: countMap[p.id] || 0,
          }))
        );
      }
      setLoading(false);
    };
    load();
  }, []);

  const filtered = customers.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.full_name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.phone.includes(q)
    );
  });

  const handleToggleBlock = async () => {
    if (!confirmTarget) return;
    setProcessing(true);

    const supabase = createClient();
    const newBlocked = !confirmTarget.is_blocked;

    const { error } = await supabase
      .from("profiles")
      .update({ is_blocked: newBlocked })
      .eq("id", confirmTarget.id);

    if (!error) {
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === confirmTarget.id ? { ...c, is_blocked: newBlocked } : c
        )
      );
      toast({
        type: newBlocked ? "warning" : "success",
        title: newBlocked ? "Customer Banned" : "Customer Unbanned",
        message: `${confirmTarget.full_name || confirmTarget.email} has been ${newBlocked ? "banned" : "unbanned"}`,
      });
    } else {
      toast({ type: "error", title: "Failed", message: error.message });
    }

    setProcessing(false);
    setConfirmTarget(null);
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
      </div>
    );
  }

  const blockedCount = customers.filter((c) => c.is_blocked).length;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="mt-1 text-sm text-slate-400">
            {customers.length} total &middot; {blockedCount} banned
          </p>
        </div>
      </div>

      <div className="mt-6 relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or phone…"
          className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 outline-none focus:border-brand-500"
        />
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03]">
                <th className="px-4 py-3 font-medium text-slate-400">Customer</th>
                <th className="hidden px-4 py-3 font-medium text-slate-400 md:table-cell">Account</th>
                <th className="hidden px-4 py-3 font-medium text-slate-400 lg:table-cell">Joined</th>
                <th className="px-4 py-3 font-medium text-slate-400">Jobs</th>
                <th className="px-4 py-3 font-medium text-slate-400">Status</th>
                <th className="px-4 py-3 font-medium text-slate-400">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-500">
                    <Users className="mx-auto h-8 w-8 text-slate-600" />
                    <p className="mt-2">No customers found</p>
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr
                    key={c.id}
                    className={`border-b border-white/[0.06] transition-colors hover:bg-white/[0.03] ${
                      c.is_blocked ? "opacity-60" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{c.full_name || "Unnamed"}</p>
                          {c.is_blocked && (
                            <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-bold text-red-400">
                              BANNED
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Mail className="h-3 w-3" />
                          {c.email}
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        c.account_type === "business"
                          ? "bg-indigo-500/20 text-indigo-400"
                          : "bg-slate-500/20 text-slate-400"
                      }`}>
                        {c.account_type === "business" ? "Business" : "Personal"}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-slate-400 lg:table-cell">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3 w-3" />
                        {new Date(c.created_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium">{c.job_count}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        c.is_blocked
                          ? "bg-red-500/20 text-red-400"
                          : "bg-emerald-500/20 text-emerald-400"
                      }`}>
                        {c.is_blocked ? "Banned" : "Active"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setConfirmTarget(c)}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                          c.is_blocked
                            ? "text-emerald-400 hover:bg-emerald-500/20"
                            : "text-red-400 hover:bg-red-500/20"
                        }`}
                      >
                        {c.is_blocked ? (
                          <>
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Unban
                          </>
                        ) : (
                          <>
                            <Ban className="h-3.5 w-3.5" />
                            Ban
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirm Ban/Unban Modal */}
      {confirmTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setConfirmTarget(null)}
        >
          <div
            className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setConfirmTarget(null)}
              className="absolute right-4 top-4 text-slate-500 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2">
              <AlertTriangle className={`h-5 w-5 ${confirmTarget.is_blocked ? "text-emerald-400" : "text-red-400"}`} />
              <h2 className="text-lg font-bold">
                {confirmTarget.is_blocked ? "Unban Customer" : "Ban Customer"}
              </h2>
            </div>

            <div className="mt-3 rounded-xl bg-white/5 p-3">
              <p className="text-sm font-medium">{confirmTarget.full_name || "Unnamed"}</p>
              <p className="text-xs text-slate-400">{confirmTarget.email}</p>
              <p className="mt-1 text-xs text-slate-500">{confirmTarget.job_count} jobs submitted</p>
            </div>

            <p className="mt-3 text-sm text-slate-400">
              {confirmTarget.is_blocked
                ? "This will restore the customer's ability to submit jobs and use the platform."
                : "This customer will be blocked from submitting new jobs. Existing jobs will remain but cannot progress."}
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setConfirmTarget(null)}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={handleToggleBlock}
                disabled={processing}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 ${
                  confirmTarget.is_blocked
                    ? "bg-emerald-600 hover:bg-emerald-500"
                    : "bg-red-600 hover:bg-red-500"
                }`}
              >
                {processing && <Loader2 className="h-4 w-4 animate-spin" />}
                {confirmTarget.is_blocked ? "Unban" : "Ban Customer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
