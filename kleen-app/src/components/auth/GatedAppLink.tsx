"use client";

import Link from "next/link";
import { useSiteAccess } from "@/components/auth/SiteAccessProvider";
import { isGatedCustomerHref } from "@/lib/site-access-gate-public";

type Props = React.ComponentProps<typeof Link>;

export default function GatedAppLink({ href, onClick, ...props }: Props) {
  const { gateEnabled, unlocked, requestAccess } = useSiteAccess();
  const hrefStr =
    typeof href === "string"
      ? href
      : typeof href === "object" && href && "pathname" in href
        ? `${href.pathname ?? ""}`
        : "";
  const needsGate = gateEnabled && !unlocked && isGatedCustomerHref(hrefStr);

  return (
    <Link
      href={href}
      {...props}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        if (!needsGate) return;
        e.preventDefault();
        void requestAccess(hrefStr);
      }}
    />
  );
}
