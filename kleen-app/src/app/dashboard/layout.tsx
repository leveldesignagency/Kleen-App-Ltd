import DashboardSidebar from "@/components/layout/DashboardSidebar";
import ToastContainer from "@/components/ui/Toast";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-slate-50">
      <DashboardSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-3 py-4 sm:px-4 sm:py-5 lg:px-5 lg:py-6">
          {children}
        </div>
      </main>
      <ToastContainer />
    </div>
  );
}
