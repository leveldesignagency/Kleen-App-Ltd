"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Loader2, Lock } from "lucide-react";
import { isSiteAccessGateEnabledPublic } from "@/lib/site-access-gate-public";

type SiteAccessContextValue = {
  gateEnabled: boolean;
  unlocked: boolean;
  checking: boolean;
  /** Show password modal; resolves true when access granted. */
  requestAccess: (targetHref?: string) => Promise<boolean>;
};

const SiteAccessContext = createContext<SiteAccessContextValue | null>(null);

export function useSiteAccess() {
  const ctx = useContext(SiteAccessContext);
  if (!ctx) {
    return {
      gateEnabled: false,
      unlocked: true,
      checking: false,
      requestAccess: async () => true,
    };
  }
  return ctx;
}

export function SiteAccessProvider({ children }: { children: React.ReactNode }) {
  const publicHint = isSiteAccessGateEnabledPublic();
  // Optimistic: treat as locked while we ask the server — never default unlocked=true.
  const [gateEnabled, setGateEnabled] = useState(true);
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [credentialsConfigured, setCredentialsConfigured] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const resolveRef = useRef<((ok: boolean) => void) | null>(null);
  const statusReadyRef = useRef<Promise<void> | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/site-access/status", {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json()) as {
        unlocked?: boolean;
        enabled?: boolean;
        disabled?: boolean;
        credentialsConfigured?: boolean;
      };
      const enabled =
        typeof data.enabled === "boolean"
          ? data.enabled
          : data.disabled === true
            ? false
            : publicHint;
      setGateEnabled(enabled);
      setUnlocked(enabled ? Boolean(data.unlocked) : true);
      if (typeof data.credentialsConfigured === "boolean") {
        setCredentialsConfigured(data.credentialsConfigured);
      }
    } catch {
      // Network failure: keep gate on if public flag says so, else open
      setGateEnabled(publicHint);
      setUnlocked(!publicHint);
    } finally {
      setChecking(false);
    }
  }, [publicHint]);

  useEffect(() => {
    statusReadyRef.current = refreshStatus();
  }, [refreshStatus]);

  const finishRequest = useCallback((ok: boolean, href: string | null) => {
    resolveRef.current?.(ok);
    resolveRef.current = null;
    setModalOpen(false);
    setPendingHref(null);
    setError("");
    setUsername("");
    setPassword("");
    if (ok && href) {
      window.location.assign(href);
    }
  }, []);

  const requestAccess = useCallback(
    async (targetHref?: string) => {
      // Wait for status so we don't skip the modal before knowing gate state
      if (statusReadyRef.current) {
        await statusReadyRef.current;
      } else {
        await refreshStatus();
      }

      // Re-read via a one-shot status check for accuracy after await
      let enabled = gateEnabled;
      let isUnlocked = unlocked;
      try {
        const res = await fetch("/api/site-access/status", {
          credentials: "include",
          cache: "no-store",
        });
        const data = (await res.json()) as {
          unlocked?: boolean;
          enabled?: boolean;
          disabled?: boolean;
          credentialsConfigured?: boolean;
        };
        enabled =
          typeof data.enabled === "boolean"
            ? data.enabled
            : data.disabled === true
              ? false
              : publicHint;
        isUnlocked = enabled ? Boolean(data.unlocked) : true;
        setGateEnabled(enabled);
        setUnlocked(isUnlocked);
        if (typeof data.credentialsConfigured === "boolean") {
          setCredentialsConfigured(data.credentialsConfigured);
        }
      } catch {
        /* keep state */
      }

      if (!enabled || isUnlocked) {
        if (targetHref) window.location.assign(targetHref);
        return true;
      }

      setPendingHref(targetHref ?? null);
      setModalOpen(true);
      return new Promise<boolean>((resolve) => {
        resolveRef.current = resolve;
      });
    },
    [gateEnabled, unlocked, publicHint, refreshStatus],
  );

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const href = pendingHref;
    try {
      const res = await fetch("/api/site-access/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Access denied");
        return;
      }
      setUnlocked(true);
      finishRequest(true, href);
    } catch {
      setError("Could not verify access");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    finishRequest(false, null);
  };

  const value: SiteAccessContextValue = {
    gateEnabled,
    unlocked,
    checking,
    requestAccess,
  };

  return (
    <SiteAccessContext.Provider value={value}>
      {children}
      {modalOpen ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/95 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-8 shadow-2xl">
            <div className="mb-6 flex items-center justify-center gap-2 text-brand-400">
              <Lock className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-widest">
                Private preview
              </span>
            </div>
            <h2 className="text-center text-xl font-bold text-white">Private preview</h2>
            <p className="mt-2 text-center text-sm text-slate-400">
              Kleen is not open to the public yet. Enter the preview password to continue —
              you will still sign in with Google after this.
            </p>
            {!credentialsConfigured && gateEnabled ? (
              <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-center text-xs text-amber-200">
                Preview credentials are not configured on this server. Set{" "}
                <code className="text-amber-100">SITE_ACCESS_GATE_ENABLED</code>,{" "}
                <code className="text-amber-100">SITE_ACCESS_USERNAME</code> and{" "}
                <code className="text-amber-100">SITE_ACCESS_PASSWORD</code> on the Vercel
                project that serves dashboard.kleenapp.co.uk, then redeploy.
              </p>
            ) : null}
            <form onSubmit={handleUnlock} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300">
                  Preview username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input-field mt-1 bg-slate-800 text-white"
                  autoComplete="username"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">
                  Preview password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field mt-1 bg-slate-800 text-white"
                  autoComplete="current-password"
                  required
                />
              </div>
              {error ? (
                <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-400">{error}</p>
              ) : null}
              <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                {loading ? (
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                ) : (
                  "Continue"
                )}
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="w-full text-sm text-slate-500 hover:text-slate-300"
              >
                Cancel
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </SiteAccessContext.Provider>
  );
}
