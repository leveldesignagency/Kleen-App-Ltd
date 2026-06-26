"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useSiteAccess } from "@/components/auth/SiteAccessProvider";

type Props = {
  children: React.ReactNode;
};

/** Blocks page content until preview password is entered (sign-in / job-flow). */
export default function SiteAccessGate({ children }: Props) {
  const { gateEnabled, unlocked, checking, requestAccess } = useSiteAccess();

  useEffect(() => {
    if (gateEnabled && !checking && !unlocked) {
      void requestAccess();
    }
  }, [gateEnabled, checking, unlocked, requestAccess]);

  if (!gateEnabled) return <>{children}</>;

  if (checking) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-500">
        Private preview — enter password to continue.
      </div>
    );
  }

  return <>{children}</>;
}
