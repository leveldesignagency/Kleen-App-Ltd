"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import {
  DEFAULT_ADMIN_PREFERENCES,
  parseAdminPreferences,
  type AdminDisplayPreferences,
  type AdminStaffProfile,
  type AdminStaffRole,
} from "@/lib/admin-staff";

type AdminStaffContextValue = {
  profile: AdminStaffProfile | null;
  loading: boolean;
  refresh: () => Promise<void>;
  updateProfile: (patch: {
    full_name?: string;
    phone?: string;
    admin_preferences?: Partial<AdminDisplayPreferences>;
  }) => Promise<boolean>;
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
      setProfile({
        ...json.profile,
        admin_preferences: parseAdminPreferences(json.profile.admin_preferences),
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
      });
      return true;
    },
    [],
  );

  const preferences = profile?.admin_preferences ?? DEFAULT_ADMIN_PREFERENCES;
  const isSuperadmin = profile?.admin_role === "superadmin";

  return (
    <AdminStaffContext.Provider
      value={{ profile, loading, refresh, updateProfile, isSuperadmin, preferences }}
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

/** Optional hook for components outside provider (returns defaults). */
export function useAdminStaffOptional() {
  return useContext(AdminStaffContext);
}

export function roleLabel(role: AdminStaffRole | null | undefined): string {
  if (role === "superadmin") return "Superadmin";
  return "Staff";
}
