"use client";

import { useEffect } from "react";

/**
 * Kill stale service workers that cached old JS (auth refresh storms / missing gate fixes).
 * Re-register the fixed sw.js after a clean slate.
 */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;

    let cancelled = false;

    (async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
        if (cancelled) return;
        await navigator.serviceWorker.register("/sw.js?v=3");
      } catch {
        // Silent fail
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
