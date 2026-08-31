"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DEFAULT_ADMIN_PREFERENCES,
  parseAdminPreferences,
  type AdminDisplayPreferences,
  type AdminPermission,
  type AdminStaffProfile,
  type AdminStaffRole,
} from "@/lib/admin-staff";
import { hasPermission, isMasterAdmin, resolvePermissions } from "@/lib/admin-permissions";

type AdminStaffContextValue = {
  profile: AdminStaffProfile | null;
  loading: boolean;
  refresh: () => Promise<void>;
  updateProfile: (patch: {
    full_name?: string;
    phone?: string;
    admin_preferences?: Partial<AdminDisplayPreferences>;
  }) => Promise<boolean>;
  permissions: AdminPermission[];
  hasPermission: (permission: AdminPermission) => boolean;
  isMasterAdmin: boolean;
  /** @deprecated use hasPermission('team.manage') */
  isSuperadmin: boolean;
  preferences: AdminDisplayPreferences;
};

const AdminStaffContext = createContext<AdminStaffContextValue | null>(null);

export function AdminStaffProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<AdminStaffProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/staff/me", { credentials: "include" });
      if (!res.ok) {
        setProfile(null);
        return;
      }
      const json = (await res.json()) as { profile: AdminStaffProfile };
      const prefs = parseAdminPreferences(json.profile.admin_preferences);
      setProfile({
        ...json.profile,
        admin_preferences: prefs,
        admin_permissions: json.profile.admin_permissions ?? [],
        permissions: json.profile.permissions ?? [],
      });
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const updateProfile = useCallback(
    async (patch: {
      full_name?: string;
      phone?: string;
      admin_preferences?: Partial<AdminDisplayPreferences>;
    }) => {
      const res = await fetch("/api/admin/staff/me", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) return false;
      const json = (await res.json()) as { profile: AdminStaffProfile };
      setProfile({
        ...json.profile,
        admin_preferences: parseAdminPreferences(json.profile.admin_preferences),
        admin_permissions: json.profile.admin_permissions ?? [],
        permissions: json.profile.permissions ?? [],
      });
      return true;
    },
    [],
  );

  const preferences = profile?.admin_preferences ?? DEFAULT_ADMIN_PREFERENCES;
  const permissions = useMemo(
    () =>
      profile?.permissions ??
      resolvePermissions(profile?.admin_role, profile?.admin_permissions ?? []),
    [profile],
  );

  const checkPermission = useCallback(
    (permission: AdminPermission) =>
      hasPermission(profile?.admin_role, profile?.admin_permissions ?? [], permission),
    [profile],
  );

  const master = isMasterAdmin(profile?.admin_role);

  return (
    <AdminStaffContext.Provider
      value={{
        profile,
        loading,
        refresh,
        updateProfile,
        permissions,
        hasPermission: checkPermission,
        isMasterAdmin: master,
        isSuperadmin: master || checkPermission("team.manage"),
        preferences,
      }}
    >
      {children}
    </AdminStaffContext.Provider>
  );
}

export function useAdminStaff() {
  const ctx = useContext(AdminStaffContext);
  if (!ctx) throw new Error("useAdminStaff must be used within AdminStaffProvider");
  return ctx;
}

export function useAdminStaffOptional() {
  return useContext(AdminStaffContext);
}

export { roleLabel } from "@/lib/admin-permissions";

export type { AdminStaffRole };
