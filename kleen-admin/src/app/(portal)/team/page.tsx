"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  FileText,
  Loader2,
  Shield,
  UserPlus,
  Users,
  Trash2,
  Upload,
} from "lucide-react";
import { useAdminStaff } from "@/components/admin/AdminStaffProvider";
import { useAdminNotifications } from "@/lib/admin-notifications";
import CustomDropdown from "@/components/ui/CustomDropdown";
import PermissionCheckboxGrid from "@/components/team/PermissionCheckboxGrid";
import {
  PERMISSION_GROUPS,
  ROLE_LABELS,
  ROLE_TEMPLATES,
  grantablePermissions,
  normalizeAdminRole,
  roleLabel,
  type AdminPermission,
  type AdminStaffRole,
} from "@/lib/admin-permissions";

type StaffRecord = {
  profile_id: string;
  job_title: string | null;
  department: string | null;
  employment_status: string;
  start_date: string | null;
  reports_to: string | null;
  contract_filename: string | null;
  contract_uploaded_at: string | null;
  internal_notes: string | null;
};

type StaffMember = {
  id: string;
  email: string;
  full_name: string | null;
  admin_role: AdminStaffRole;
  admin_permissions: AdminPermission[];
  permissions: AdminPermission[];
  record: StaffRecord | null;
};

type AllowlistEntry = {
  email: string;
  admin_role: AdminStaffRole;
  admin_permissions: AdminPermission[];
};

type Tab = "directory" | "hire" | "pending";

const STATUS_OPTIONS = [
  { value: "onboarding", label: "Onboarding" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "terminated", label: "Terminated" },
];

const DEPT_OPTIONS = [
  { value: "operations", label: "Operations" },
  { value: "customer_support", label: "Customer support" },
  { value: "contractor_ops", label: "Contractor operations" },
  { value: "legal", label: "Legal & compliance" },
  { value: "finance", label: "Finance" },
  { value: "leadership", label: "Leadership" },
];

export default function TeamPage() {
  const { profile, hasPermission, loading: authLoading } = useAdminStaff();
  const toast = useAdminNotifications((s) => s.push);

  const [tab, setTab] = useState<Tab>("directory");
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [allowlist, setAllowlist] = useState<AllowlistEntry[]>([]);
  const [assignableRoles, setAssignableRoles] = useState<AdminStaffRole[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [hireEmail, setHireEmail] = useState("");
  const [hireRole, setHireRole] = useState<AdminStaffRole>("support");
  const [hirePerms, setHirePerms] = useState<AdminPermission[]>([]);
  const [hireTitle, setHireTitle] = useState("");
  const [hireDept, setHireDept] = useState("customer_support");
  const [hireNotes, setHireNotes] = useState("");
  const [hiring, setHiring] = useState(false);

  const [editRole, setEditRole] = useState<AdminStaffRole>("support");
  const [editPerms, setEditPerms] = useState<AdminPermission[]>([]);
  const [editStatus, setEditStatus] = useState("active");
  const [editTitle, setEditTitle] = useState("");
  const [editDept, setEditDept] = useState("");
  const [savingMember, setSavingMember] = useState(false);
  const [uploadingContract, setUploadingContract] = useState(false);

  const canView = hasPermission("team.view");
  const canInvite = hasPermission("team.invite");
  const canManage = hasPermission("team.manage");
  const canContracts = hasPermission("team.contracts");

  const grantable = useMemo(
    () => grantablePermissions(profile?.admin_role, profile?.admin_permissions ?? []),
    [profile],
  );

  const roleOptions = useMemo(
    () =>
      assignableRoles.map((r) => ({
        value: r,
        label: ROLE_LABELS[r],
      })),
    [assignableRoles],
  );

  const load = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/team", { credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ type: "error", title: json.error || "Could not load team" });
        return;
      }
      setStaff(json.staff || []);
      setAllowlist(json.allowlist || []);
      setAssignableRoles(json.assignableRoles || []);
    } finally {
      setLoading(false);
    }
  }, [canView, toast]);

  useEffect(() => {
    if (!authLoading && canView) void load();
  }, [authLoading, canView, load]);

  const selected = staff.find((s) => s.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected) return;
    setEditRole(selected.admin_role);
    setEditPerms(selected.admin_permissions);
    setEditStatus(selected.record?.employment_status || "active");
    setEditTitle(selected.record?.job_title || "");
    setEditDept(selected.record?.department || "");
  }, [selected]);

  useEffect(() => {
    const template = ROLE_TEMPLATES[hireRole] ?? [];
    setHirePerms(template.filter((p: AdminPermission) => grantable.includes(p)));
  }, [hireRole, grantable]);

  const hireStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canInvite) return;
    setHiring(true);
    const res = await fetch("/api/admin/team", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: hireEmail,
        admin_role: hireRole,
        admin_permissions: hirePerms,
        job_title: hireTitle,
        department: hireDept,
        internal_notes: hireNotes,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setHiring(false);
    if (!res.ok) {
      toast({ type: "error", title: json.error || "Could not invite" });
      return;
    }
    toast({
      type: "success",
      title: "Staff provisioned",
      message: json.pending_signup
        ? "Allowlist updated — they can sign in once their Supabase Auth account exists."
        : "Existing user promoted to admin.",
    });
    setHireEmail("");
    setHireNotes("");
    void load();
    setTab("directory");
  };

  const saveMember = async () => {
    if (!selected || !canManage) return;
    setSavingMember(true);
    const res = await fetch(`/api/admin/team/${selected.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        admin_role: editRole,
        admin_permissions: editPerms,
        job_title: editTitle,
        department: editDept,
        employment_status: editStatus,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setSavingMember(false);
    if (!res.ok) {
      toast({ type: "error", title: json.error || "Could not save" });
      return;
    }
    toast({ type: "success", title: "Member updated" });
    void load();
  };

  const uploadContract = async (file: File) => {
    if (!selected || !canContracts) return;
    setUploadingContract(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/admin/team/${selected.id}/contract`, {
      method: "POST",
      credentials: "include",
      body: fd,
    });
    const json = await res.json().catch(() => ({}));
    setUploadingContract(false);
    if (!res.ok) {
      toast({ type: "error", title: json.error || "Upload failed" });
      return;
    }
    toast({ type: "success", title: "Contract uploaded", message: file.name });
    void load();
  };

  const downloadContract = async () => {
    if (!selected) return;
    const res = await fetch(`/api/admin/team/${selected.id}/contract`, { credentials: "include" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast({ type: "error", title: json.error || "No contract" });
      return;
    }
    window.open(json.signedUrl, "_blank", "noopener,noreferrer");
  };

  const removeAllowlist = async (email: string) => {
    const res = await fetch(`/api/admin/team?email=${encodeURIComponent(email)}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      toast({ type: "error", title: json.error || "Could not remove" });
      return;
    }
    toast({ type: "success", title: "Removed from allowlist" });
    void load();
  };

  const revokeAccess = async (id: string) => {
    if (!window.confirm("Revoke admin access for this person? They will become a customer account.")) return;
    const res = await fetch(`/api/admin/team/${id}`, { method: "DELETE", credentials: "include" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast({ type: "error", title: json.error || "Could not revoke" });
      return;
    }
    toast({ type: "success", title: "Access revoked" });
    setSelectedId(null);
    void load();
  };

  if (authLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-8 text-center">
        <Shield className="mx-auto h-10 w-10 text-amber-400" />
        <h1 className="mt-4 text-lg font-semibold text-white">Team access required</h1>
        <p className="mt-2 text-sm text-slate-400">
          You don&apos;t have permission to view the team directory. Ask a manager or master admin.
        </p>
        <Link href="/" className="mt-4 inline-block text-sm text-brand-400 hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const pendingAllowlist = allowlist.filter(
    (a) => !staff.some((s) => s.email.toLowerCase() === a.email.toLowerCase()),
  );

  const TABS: { id: Tab; label: string; show: boolean }[] = [
    { id: "directory", label: "Directory", show: true },
    { id: "hire", label: "Hire staff", show: canInvite },
    { id: "pending", label: `Pending (${pendingAllowlist.length})`, show: canInvite || canManage },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
            <Users className="h-7 w-7 text-brand-400" />
            Team &amp; HR
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Company structure, role-based access, and employment contracts. You can only grant permissions
            you hold — hiring managers cannot elevate anyone above their own access level.
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-slate-400">
          <p>
            Signed in as <span className="text-white">{profile?.email}</span>
          </p>
          <p className="mt-0.5">
            Role: <span className="font-medium text-brand-300">{roleLabel(profile?.admin_role)}</span>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-white/10">
        {TABS.filter((t) => t.show).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              tab === t.id
                ? "border-brand-500 text-brand-400"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
        </div>
      ) : tab === "hire" && canInvite ? (
        <form onSubmit={hireStaff} className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
              <UserPlus className="h-4 w-4 text-brand-400" />
              New staff member
            </h2>
            <label className="block text-xs text-slate-400">
              Work email
              <input
                type="email"
                required
                value={hireEmail}
                onChange={(e) => setHireEmail(e.target.value)}
                placeholder="name@kleenapp.co.uk"
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white"
              />
            </label>
            <div>
              <span className="text-xs text-slate-400">Role</span>
              <CustomDropdown
                className="mt-1"
                value={hireRole}
                onChange={(v) => setHireRole(normalizeAdminRole(v))}
                options={roleOptions}
              />
            </div>
            <label className="block text-xs text-slate-400">
              Job title
              <input
                value={hireTitle}
                onChange={(e) => setHireTitle(e.target.value)}
                placeholder="Customer support agent"
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white"
              />
            </label>
            <div>
              <span className="text-xs text-slate-400">Department</span>
              <CustomDropdown
                className="mt-1"
                value={hireDept}
                onChange={setHireDept}
                options={DEPT_OPTIONS}
              />
            </div>
            <label className="block text-xs text-slate-400">
              Internal notes
              <textarea
                value={hireNotes}
                onChange={(e) => setHireNotes(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white"
              />
            </label>
            <button
              type="submit"
              disabled={hiring || !hireEmail.trim()}
              className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
            >
              {hiring ? "Provisioning…" : "Add to allowlist"}
            </button>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-sm font-semibold text-white">Access permissions</h2>
            <p className="mt-1 text-xs text-slate-500">
              Pre-filled from role template. Uncheck anything this person shouldn&apos;t have — you can only
              grant what you already hold.
            </p>
            <div className="mt-4 space-y-6">
              {PERMISSION_GROUPS.map((g) => {
                const perms = g.permissions.filter((p) => grantable.includes(p));
                if (!perms.length) return null;
                return (
                  <div key={g.label}>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      {g.label}
                    </p>
                    <PermissionCheckboxGrid
                      permissions={perms}
                      selected={hirePerms}
                      onChange={setHirePerms}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </form>
      ) : tab === "pending" ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-sm font-semibold text-white">Awaiting first sign-in</h2>
          <p className="mt-1 text-xs text-slate-500">
            These emails are on the allowlist but haven&apos;t created a Supabase Auth account yet.
          </p>
          <ul className="mt-4 divide-y divide-white/5">
            {pendingAllowlist.length === 0 ? (
              <li className="py-6 text-center text-sm text-slate-500">No pending invites.</li>
            ) : (
              pendingAllowlist.map((a) => (
                <li key={a.email} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-white">{a.email}</p>
                    <p className="text-xs text-slate-500">{roleLabel(a.admin_role)}</p>
                  </div>
                  {canManage && a.email.toLowerCase() !== "info@kleenapp.co.uk" && (
                    <button
                      type="button"
                      onClick={() => void removeAllowlist(a.email)}
                      className="rounded-lg p-2 text-slate-500 hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2 space-y-2">
            {staff.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedId(s.id)}
                className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                  selectedId === s.id
                    ? "border-brand-500/40 bg-brand-500/10"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
                }`}
              >
                <p className="font-medium text-white">{s.full_name || s.email}</p>
                <p className="text-xs text-slate-500">{s.email}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase text-brand-400">
                    {roleLabel(s.admin_role)}
                  </span>
                  {s.record?.department && (
                    <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">
                      {s.record.department.replace(/_/g, " ")}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>

          <div className="lg:col-span-3">
            {!selected ? (
              <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-white/10 text-sm text-slate-500">
                Select a team member
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                  <h2 className="text-lg font-semibold text-white">{selected.full_name || selected.email}</h2>
                  <p className="text-sm text-slate-400">{selected.email}</p>

                  {canManage && (
                    <div className="mt-6 space-y-4">
                      <div>
                        <span className="text-xs text-slate-400">Role</span>
                        <CustomDropdown
                          className="mt-1"
                          value={editRole}
                          onChange={(v) => {
                            const r = normalizeAdminRole(v);
                            setEditRole(r);
                            setEditPerms(
                              (ROLE_TEMPLATES[r] ?? []).filter((p: AdminPermission) =>
                                grantable.includes(p),
                              ),
                            );
                          }}
                          options={roleOptions}
                        />
                      </div>
                      <div>
                        <span className="text-xs text-slate-400">Employment status</span>
                        <CustomDropdown
                          className="mt-1"
                          value={editStatus}
                          onChange={setEditStatus}
                          options={STATUS_OPTIONS}
                        />
                      </div>
                      <label className="block text-xs text-slate-400">
                        Job title
                        <input
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white"
                        />
                      </label>
                      <div>
                        <span className="text-xs text-slate-400">Department</span>
                        <CustomDropdown
                          className="mt-1"
                          value={editDept || "operations"}
                          onChange={setEditDept}
                          options={DEPT_OPTIONS}
                        />
                      </div>
                      <PermissionCheckboxGrid
                        permissions={grantable}
                        selected={editPerms}
                        onChange={setEditPerms}
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void saveMember()}
                          disabled={savingMember}
                          className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
                        >
                          {savingMember ? "Saving…" : "Save changes"}
                        </button>
                        {selected.id !== profile?.id && (
                          <button
                            type="button"
                            onClick={() => void revokeAccess(selected.id)}
                            className="rounded-xl border border-red-500/30 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10"
                          >
                            Revoke access
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {canContracts && (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                      <FileText className="h-4 w-4 text-brand-400" />
                      Employment contract (PDF)
                    </h3>
                    {selected.record?.contract_filename ? (
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <span className="text-sm text-slate-300">{selected.record.contract_filename}</span>
                        <button
                          type="button"
                          onClick={() => void downloadContract()}
                          className="text-sm text-brand-400 hover:underline"
                        >
                          Download
                        </button>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-slate-500">No contract uploaded yet.</p>
                    )}
                    <label className="mt-4 flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-white/20 px-4 py-3 text-sm text-slate-400 hover:bg-white/[0.03]">
                      <Upload className="h-4 w-4" />
                      {uploadingContract ? "Uploading…" : "Upload PDF contract"}
                      <input
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        disabled={uploadingContract}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void uploadContract(f);
                        }}
                      />
                    </label>
                  </div>
                )}

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Building2 className="h-4 w-4" />
                    Effective permissions
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {selected.permissions.map((p) => (
                      <span
                        key={p}
                        className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
