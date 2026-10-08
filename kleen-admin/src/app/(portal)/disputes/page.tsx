import { Suspense } from "react";
import DisputeTerminal from "@/components/disputes/DisputeTerminal";

export default function AdminDisputesPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm text-slate-500">Loading disputes…</div>}>
      <DisputeTerminal />
    </Suspense>
  );
}
