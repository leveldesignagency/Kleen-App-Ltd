"use client";

import { createContext, useContext } from "react";

export type ContractorPortalValue = {
  operativeId: string | null;
  loading: boolean;
  /** Set by Kleen admin (Contractors → verify). Until true, jobs and payouts stay locked. */
  isVerified: boolean;
  refresh: () => Promise<void>;
};

export const ContractorPortalContext = createContext<ContractorPortalValue>({
  operativeId: null,
  loading: true,
  isVerified: false,
  refresh: async () => {},
});

export function useContractorPortal() {
  return useContext(ContractorPortalContext);
}
