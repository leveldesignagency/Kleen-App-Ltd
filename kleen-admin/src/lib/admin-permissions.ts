/**
 * Kleen admin portal — role hierarchy + granular permissions.
 * Delegation rule: you may only grant permissions you hold, and roles at or below your tier.
 */

export const ADMIN_PERMISSIONS = [
  "nav.dashboard",
  "nav.jobs",
  "nav.contractors",
  "nav.disputes",
  "nav.customers",
  "nav.legal_holds",
  "nav.enforcement",
  "nav.team",
  "jobs.view",
  "jobs.manage",
  "jobs.refund",
  "jobs.release_funds",
  "contractors.view",
  "contractors.manage",
  "contractors.verify",
  "customers.view",
  "customers.manage",
  "disputes.view",
  "disputes.settle",
  "legal_holds.view",
  "legal_holds.manage",
  "enforcement.view",
  "enforcement.manage",
  "team.view",
  "team.invite",
  "team.manage",
  "team.contracts",
  "security.view",
  "security.mfa",
  "settings.profile",
  "settings.display",
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export type AdminStaffRole =
  | "master_admin"
  | "superadmin"
  | "director"
  | "manager"
  | "hiring_manager"
  | "team_lead"
  | "senior_support"
  | "support"
  | "staff"
  | "readonly";

/** Higher number = more authority in the org chart. */
export const ROLE_LEVEL: Record<AdminStaffRole, number> = {
  master_admin: 100,
  superadmin: 100,
  director: 90,
  manager: 80,
  hiring_manager: 70,
  team_lead: 60,
  senior_support: 50,
  support: 40,
  staff: 40,
  readonly: 10,
};

export const ROLE_LABELS: Record<AdminStaffRole, string> = {
  master_admin: "Master admin",
  superadmin: "Master admin",
  director: "Director",
  manager: "Manager",
  hiring_manager: "Hiring manager",
  team_lead: "Team lead",
  senior_support: "Senior support",
  support: "Support",
  staff: "Support",
  readonly: "Read-only",
};

export const PERMISSION_LABELS: Record<AdminPermission, string> = {
  "nav.dashboard": "Dashboard",
  "nav.jobs": "Jobs (nav)",
  "nav.contractors": "Contractors (nav)",
  "nav.disputes": "Disputes (nav)",
  "nav.customers": "Customers (nav)",
  "nav.legal_holds": "Legal holds (nav)",
  "nav.enforcement": "Enforcement (nav)",
  "nav.team": "Team (nav)",
  "jobs.view": "View jobs",
  "jobs.manage": "Manage jobs",
  "jobs.refund": "Issue refunds",
  "jobs.release_funds": "Release funds",
  "contractors.view": "View contractors",
  "contractors.manage": "Manage contractors",
  "contractors.verify": "Verify contractors",
  "customers.view": "View customers",
  "customers.manage": "Manage customers",
  "disputes.view": "View disputes",
  "disputes.settle": "Settle disputes",
  "legal_holds.view": "View legal holds",
  "legal_holds.manage": "Place / release legal holds",
  "enforcement.view": "View enforcement",
  "enforcement.manage": "Bans, appeals, blocklist",
  "team.view": "View team directory",
  "team.invite": "Invite new staff",
  "team.manage": "Change roles & permissions",
  "team.contracts": "Upload employment contracts",
  "security.view": "View security posture",
  "security.mfa": "Manage own MFA",
  "settings.profile": "Edit own profile",
  "settings.display": "Display preferences",
};

const ALL_PERMISSIONS = new Set<string>(ADMIN_PERMISSIONS);

const ROLE_TEMPLATES: Record<AdminStaffRole, AdminPermission[]> = {
  master_admin: [...ADMIN_PERMISSIONS],
  superadmin: [...ADMIN_PERMISSIONS],
  director: ADMIN_PERMISSIONS.filter((p) => p !== "team.manage"),
  manager: [
    "nav.dashboard",
    "nav.jobs",
    "nav.contractors",
    "nav.disputes",
    "nav.customers",
    "nav.enforcement",
    "jobs.view",
    "jobs.manage",
    "jobs.refund",
    "jobs.release_funds",
    "contractors.view",
    "contractors.manage",
    "contractors.verify",
    "customers.view",
    "customers.manage",
    "disputes.view",
    "disputes.settle",
    "enforcement.view",
    "enforcement.manage",
    "team.view",
    "security.mfa",
    "settings.profile",
    "settings.display",
  ],
  hiring_manager: [
    "nav.dashboard",
    "nav.team",
    "team.view",
    "team.invite",
    "team.contracts",
    "security.mfa",
    "settings.profile",
    "settings.display",
  ],
  team_lead: [
    "nav.dashboard",
    "nav.jobs",
    "nav.contractors",
    "nav.disputes",
    "nav.customers",
    "jobs.view",
    "jobs.manage",
    "contractors.view",
    "contractors.manage",
    "customers.view",
    "disputes.view",
    "disputes.settle",
    "security.mfa",
    "settings.profile",
    "settings.display",
  ],
  senior_support: [
    "nav.dashboard",
    "nav.jobs",
    "nav.customers",
    "nav.disputes",
    "jobs.view",
    "customers.view",
    "customers.manage",
    "disputes.view",
    "security.mfa",
    "settings.profile",
    "settings.display",
  ],
  support: [
    "nav.dashboard",
    "nav.jobs",
    "nav.customers",
    "jobs.view",
    "customers.view",
    "security.mfa",
    "settings.profile",
    "settings.display",
  ],
  staff: [
    "nav.dashboard",
    "nav.jobs",
    "nav.customers",
    "jobs.view",
    "customers.view",
    "security.mfa",
    "settings.profile",
    "settings.display",
  ],
  readonly: [
    "nav.dashboard",
    "nav.jobs",
    "nav.contractors",
    "nav.customers",
    "nav.disputes",
    "jobs.view",
    "contractors.view",
    "customers.view",
    "disputes.view",
    "security.mfa",
    "settings.profile",
    "settings.display",
  ],
};

export { ROLE_TEMPLATES };

export function normalizeAdminRole(role: string | null | undefined): AdminStaffRole {
  const r = (role || "staff") as AdminStaffRole;
  if (r in ROLE_LEVEL) return r;
  return "staff";
}

export function roleLabel(role: AdminStaffRole | string | null | undefined): string {
  return ROLE_LABELS[normalizeAdminRole(role)] ?? "Staff";
}

export function parsePermissionList(raw: unknown): AdminPermission[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((p): p is AdminPermission => typeof p === "string" && ALL_PERMISSIONS.has(p));
}

/** Effective permissions = role template ∪ explicit grants (deduped). */
export function resolvePermissions(
  role: AdminStaffRole | string | null | undefined,
  explicitGrants: unknown,
): AdminPermission[] {
  const normalized = normalizeAdminRole(role);
  const template = ROLE_TEMPLATES[normalized] ?? ROLE_TEMPLATES.staff;
  const grants = parsePermissionList(explicitGrants);
  return Array.from(new Set([...template, ...grants]));
}

export function hasPermission(
  role: AdminStaffRole | string | null | undefined,
  explicitGrants: unknown,
  permission: AdminPermission,
): boolean {
  const perms = resolvePermissions(role, explicitGrants);
  return perms.includes(permission);
}

export function isMasterAdmin(role: AdminStaffRole | string | null | undefined): boolean {
  const r = normalizeAdminRole(role);
  return r === "master_admin" || r === "superadmin";
}

/** Roles this user may assign when inviting or promoting (same tier or below, excluding master unless master). */
export function assignableRoles(
  granterRole: AdminStaffRole | string | null | undefined,
): AdminStaffRole[] {
  const level = ROLE_LEVEL[normalizeAdminRole(granterRole)];
  const roles = (Object.keys(ROLE_LEVEL) as AdminStaffRole[]).filter((r) => {
    if (r === "superadmin" || r === "staff") return false;
    if (r === "master_admin" && level < 100) return false;
    return ROLE_LEVEL[r] <= level;
  });
  return roles.sort((a, b) => ROLE_LEVEL[b] - ROLE_LEVEL[a]);
}

/** Permissions granter may pass to someone else (must hold them). */
export function grantablePermissions(
  granterRole: AdminStaffRole | string | null | undefined,
  granterGrants: unknown,
): AdminPermission[] {
  const held = new Set(resolvePermissions(granterRole, granterGrants));
  return ADMIN_PERMISSIONS.filter((p) => held.has(p));
}

export function canGrantRole(
  granterRole: AdminStaffRole | string | null | undefined,
  targetRole: AdminStaffRole | string | null | undefined,
): boolean {
  const g = normalizeAdminRole(granterRole);
  const t = normalizeAdminRole(targetRole);
  if (t === "master_admin" || t === "superadmin") return isMasterAdmin(g);
  return ROLE_LEVEL[t] <= ROLE_LEVEL[g];
}

export function canGrantPermissions(
  granterRole: AdminStaffRole | string | null | undefined,
  granterGrants: unknown,
  requested: string[],
): boolean {
  const allowed = new Set(grantablePermissions(granterRole, granterGrants));
  return requested.every((p) => allowed.has(p as AdminPermission));
}

/** Intersect requested permissions with role template + granter cap. */
export function sanitizeGrantedPermissions(
  granterRole: AdminStaffRole | string | null | undefined,
  granterGrants: unknown,
  targetRole: AdminStaffRole | string | null | undefined,
  requested: string[],
): AdminPermission[] {
  const roleTemplate = new Set(ROLE_TEMPLATES[normalizeAdminRole(targetRole)] ?? []);
  const grantable = new Set(grantablePermissions(granterRole, granterGrants));
  return requested.filter(
    (p): p is AdminPermission =>
      ALL_PERMISSIONS.has(p) && roleTemplate.has(p as AdminPermission) && grantable.has(p as AdminPermission),
  );
}

export const PERMISSION_GROUPS: { label: string; permissions: AdminPermission[] }[] = [
  {
    label: "Navigation",
    permissions: ADMIN_PERMISSIONS.filter((p) => p.startsWith("nav.")),
  },
  {
    label: "Operations",
    permissions: [
      "jobs.view",
      "jobs.manage",
      "jobs.refund",
      "jobs.release_funds",
      "contractors.view",
      "contractors.manage",
      "contractors.verify",
      "customers.view",
      "customers.manage",
      "disputes.view",
      "disputes.settle",
    ],
  },
  {
    label: "Legal & enforcement",
    permissions: [
      "legal_holds.view",
      "legal_holds.manage",
      "enforcement.view",
      "enforcement.manage",
    ],
  },
  {
    label: "Team & HR",
    permissions: ["team.view", "team.invite", "team.manage", "team.contracts"],
  },
  {
    label: "Personal",
    permissions: ["security.view", "security.mfa", "settings.profile", "settings.display"],
  },
];

export const NAV_PERMISSION_MAP: Record<string, AdminPermission> = {
  "/": "nav.dashboard",
  "/jobs": "nav.jobs",
  "/contractors": "nav.contractors",
  "/disputes": "nav.disputes",
  "/customers": "nav.customers",
  "/legal-holds": "nav.legal_holds",
  "/enforcement": "nav.enforcement",
  "/team": "nav.team",
  "/settings": "settings.profile",
};
