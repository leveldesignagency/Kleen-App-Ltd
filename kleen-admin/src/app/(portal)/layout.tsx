"use client";

import AdminSidebar from "@/components/layout/AdminSidebar";
import AdminToastContainer from "@/components/admin/AdminToastContainer";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-slate-950 text-white">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </main>
      <AdminToastContainer />
    </div>
  );
}
