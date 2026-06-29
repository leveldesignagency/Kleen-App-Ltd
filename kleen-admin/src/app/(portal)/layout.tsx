"use client";

import AdminSidebar from "@/components/layout/AdminSidebar";
import AdminTopHeader from "@/components/layout/AdminTopHeader";
import AdminToastContainer from "@/components/admin/AdminToastContainer";
import AdminRealtimeAlerts from "@/components/admin/AdminRealtimeAlerts";
import { AdminStaffProvider } from "@/components/admin/AdminStaffProvider";
import AdminPreferencesSync from "@/components/admin/AdminPreferencesSync";
import { useAdminStaffOptional } from "@/components/admin/AdminStaffProvider";

function ToastGate() {
  const staff = useAdminStaffOptional();
  const show = staff?.preferences.showToastAlerts ?? true;
  if (!show) return null;
  return <AdminToastContainer />;
}

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminStaffProvider>
      <div className="flex h-screen bg-slate-950 text-white">
        <AdminSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <AdminTopHeader />
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
          </main>
        </div>
        <AdminRealtimeAlerts />
        <AdminPreferencesSync />
        <ToastGate />
      </div>
    </AdminStaffProvider>
  );
}
