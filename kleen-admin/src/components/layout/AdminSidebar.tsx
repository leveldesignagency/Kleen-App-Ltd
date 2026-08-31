"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  MessageSquare,
  UserSearch,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  Scale,
  ShieldAlert,
  UserCog,
  Settings,
} from "lucide-react";
import { useState } from "react";
import { useAdminStaff } from "@/components/admin/AdminStaffProvider";
import { NAV_PERMISSION_MAP } from "@/lib/admin-permissions";
import type { AdminPermission } from "@/lib/admin-permissions";

const NAV_ITEMS: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission: AdminPermission;
}[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, permission: "nav.dashboard" },
  { href: "/jobs", label: "Jobs", icon: Briefcase, permission: "nav.jobs" },
  { href: "/contractors", label: "Contractors", icon: Users, permission: "nav.contractors" },
  { href: "/disputes", label: "Disputes", icon: MessageSquare, permission: "nav.disputes" },
  { href: "/customers", label: "Customers", icon: UserSearch, permission: "nav.customers" },
  { href: "/legal-holds", label: "Legal holds", icon: Scale, permission: "nav.legal_holds" },
  { href: "/enforcement", label: "Enforcement", icon: ShieldAlert, permission: "nav.enforcement" },
  { href: "/team", label: "Team & HR", icon: UserCog, permission: "nav.team" },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { hasPermission, loading } = useAdminStaff();

  const visibleNav = loading ? NAV_ITEMS.slice(0, 1) : NAV_ITEMS.filter((item) => hasPermission(item.permission));

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const sidebarContent = (
    <>
      <div className="flex items-center gap-3 px-5 py-5">
        <Image
          src="/images/kleen-logo.svg"
          alt="KLEEN"
          width={100}
          height={42}
          className="h-8 w-auto brightness-0 invert opacity-80"
        />
        <span className="flex items-center gap-1 rounded-md bg-brand-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-400">
          <ShieldCheck className="h-3 w-3" />
          Admin
        </span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {visibleNav.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`admin-nav-link flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                active
                  ? "bg-white/10 text-white"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              <Icon className={`h-4.5 w-4.5 ${active ? "text-brand-400" : "text-slate-500"}`} />
              {item.label}
            </Link>
          );
        })}
        {hasPermission("settings.profile") && (
          <Link
            href="/settings"
            onClick={() => setMobileOpen(false)}
            className={`admin-nav-link flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
              pathname.startsWith("/settings")
                ? "bg-white/10 text-white"
                : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
            }`}
          >
            <Settings className={`h-4.5 w-4.5 ${pathname.startsWith("/settings") ? "text-brand-400" : "text-slate-500"}`} />
            Settings
          </Link>
        )}
      </nav>

      <div className="border-t border-white/10 px-3 py-3">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <>
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-white/10 bg-slate-900 px-4 lg:hidden">
        <div className="flex items-center gap-2">
          <Image
            src="/images/kleen-logo.svg"
            alt="KLEEN"
            width={100}
            height={42}
            className="h-7 w-auto brightness-0 invert opacity-80"
          />
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="rounded-lg p-2 text-slate-400 hover:bg-white/10"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-14 flex h-[calc(100%-3.5rem)] w-64 flex-col bg-slate-900">
            {sidebarContent}
          </div>
        </div>
      )}

      <aside className="hidden w-64 flex-shrink-0 flex-col bg-slate-900 lg:flex">
        {sidebarContent}
      </aside>
    </>
  );
}

export { NAV_PERMISSION_MAP };
