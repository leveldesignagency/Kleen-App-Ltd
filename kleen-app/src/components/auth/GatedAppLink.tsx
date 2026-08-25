"use client";

import Link from "next/link";
import { useSiteAccess } from "@/components/auth/SiteAccessProvider";
import { isGatedCustomerHref } from "@/lib/site-access-gate-public";

type Props = React.ComponentProps<typeof Link>;

export default function GatedAppLink({ href, onClick, ...props }: Props) {
  const { checking, requestAccess } = useSiteAccess();
  const hrefStr =
    typeof href === "string"
      ? href
      : typeof href === "object" && href && "pathname" in href
        ? `${(href as { pathname?: string }).pathname ?? ""}`
        : "";
  const isGatedPath = isGatedCustomerHref(hrefStr);

  return (
    <Link
      href={href}
      {...props}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        if (!isGatedPath) return;
        // Always intercept gated paths until server status says unlocked —
        // requestAccess waits on /api/site-access/status and shows the modal when needed.
        e.preventDefault();
        if (checking) {
          void requestAccess(hrefStr);
          return;
        }
        void requestAccess(hrefStr);
      }}
    />
  );
}
