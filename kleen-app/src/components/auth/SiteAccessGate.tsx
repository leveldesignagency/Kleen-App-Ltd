"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useSiteAccess } from "@/components/auth/SiteAccessProvider";

type Props = {
  children: React.ReactNode;
};

/**
 * Hides sign-in / job-flow UI until the preview gate password is entered.
 * Does not authenticate the user — Google sign-in on the next screen still required.
 */
export default function SiteAccessGate({ children }: Props) {
  const { gateEnabled, unlocked, checking, requestAccess } = useSiteAccess();

  useEffect(() => {
    if (gateEnabled && !checking && !unlocked) {
      void requestAccess();
    }
  }, [gateEnabled, checking, unlocked, requestAccess]);

  if (!gateEnabled || unlocked) return <>{children}</>;

  if (checking) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  // Preview modal is rendered by SiteAccessProvider — keep sign-in hidden until passed.
  return null;
}
