"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import {
  LayoutDashboard,
  Briefcase,
  UserCircle,
  Plus,
  AlertTriangle,
  RefreshCw,
  MapPin,
  CreditCard,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const SIDEBAR_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/jobs", label: "My Jobs", icon: Briefcase },
  { href: "/dashboard/recurring", label: "Recurring Cleans", icon: RefreshCw },
  { href: "/dashboard/addresses", label: "Addresses", icon: MapPin },
  { href: "/dashboard/payment-methods", label: "Payment Methods", icon: CreditCard },
  { href: "/dashboard/account", label: "Account", icon: Settings },
  { href: "/dashboard/profile", label: "Profile", icon: UserCircle },
  { href: "/dashboard/disputes", label: "Disputes", icon: AlertTriangle },
];

export default function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setMobileOpen(false);
    router.push("/");
    router.refresh();
  };

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const sidebarContent = (
    <>
      <Link href="/" className="flex items-center px-4 py-5">
        <Image
          src="/images/kleen-logo.svg"
          alt="KLEEN"
          width={140}
          height={58}
          className="h-12 w-auto"
        />
      </Link>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {SIDEBAR_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                active
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon className={`h-4.5 w-4.5 ${active ? "text-brand-600" : "text-slate-400"}`} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-100 px-3 py-3">
        <Link
          href="/job-flow"
          onClick={() => setMobileOpen(false)}
          className="btn-primary w-full gap-2 py-2.5 text-xs"
        >
          <Plus className="h-4 w-4" />
          New Job
        </Link>
      </div>

      <div className="border-t border-slate-100 px-3 py-3">
        <button
          type="button"
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile header */}
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-slate-100 bg-white px-4 lg:hidden">
        <Link href="/" className="flex items-center">
          <Image
            src="/images/kleen-logo.svg"
            alt="KLEEN"
            width={140}
            height={58}
            className="h-11 w-auto"
          />
        </Link>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/20" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-14 flex h-[calc(100%-3.5rem)] w-64 flex-col bg-white shadow-xl">
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden w-64 flex-shrink-0 flex-col border-r border-slate-100 bg-white lg:flex">
        {sidebarContent}
      </aside>
    </>
  );
}
