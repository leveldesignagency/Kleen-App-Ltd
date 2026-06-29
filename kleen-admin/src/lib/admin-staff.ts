export type AdminStaffRole = "superadmin" | "staff";

export type AdminDisplayPreferences = {
  compactTables: boolean;
  alertSounds: boolean;
  showToastAlerts: boolean;
};

export const DEFAULT_ADMIN_PREFERENCES: AdminDisplayPreferences = {
  compactTables: false,
  alertSounds: true,
  showToastAlerts: true,
};

export type AdminStaffProfile = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  admin_role: AdminStaffRole | null;
  admin_preferences: AdminDisplayPreferences;
};

export function parseAdminPreferences(raw: unknown): AdminDisplayPreferences {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_ADMIN_PREFERENCES };
  const o = raw as Record<string, unknown>;
  return {
    compactTables: o.compactTables === true,
    alertSounds: o.alertSounds !== false,
    showToastAlerts: o.showToastAlerts !== false,
  };
}

export function staffInitials(name: string | null | undefined, email: string): string {
  const n = name?.trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return n.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}
