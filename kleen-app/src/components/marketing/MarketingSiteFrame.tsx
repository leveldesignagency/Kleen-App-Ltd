import type { ReactNode } from "react";

export default function MarketingSiteFrame({ children }: { children: ReactNode }) {
  return <div className="marketing-site-shell min-h-screen bg-white">{children}</div>;
}
