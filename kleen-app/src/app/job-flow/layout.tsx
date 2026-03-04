import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Book a Clean",
  description: "Start your cleaning job request with KLEEN.",
};

export default function JobFlowLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {children}
    </div>
  );
}
