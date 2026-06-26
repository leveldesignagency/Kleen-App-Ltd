"use client";

import { useCallback, useEffect, useState } from "react";

export type ServiceHealthState = {
  loading: boolean;
  ok: boolean;
  error?: string;
  recheck: () => void;
};

export function useServiceHealth(enabled = true): ServiceHealthState {
  const [loading, setLoading] = useState(enabled);
  const [ok, setOk] = useState(true);
  const [error, setError] = useState<string | undefined>();

  const recheck = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setOk(true);
        setError(undefined);
      } else {
        setOk(false);
        setError(data.error || `Service unavailable (${res.status})`);
      }
    } catch (e) {
      setOk(false);
      setError(e instanceof Error ? e.message : "Could not reach Kleen services");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setOk(true);
      return;
    }
    recheck();
  }, [enabled, recheck]);

  return { loading, ok, error, recheck };
}
