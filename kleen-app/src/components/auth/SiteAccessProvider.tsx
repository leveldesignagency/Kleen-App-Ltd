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
  const gateEnabled = isSiteAccessGateEnabledPublic();
  const [unlocked, setUnlocked] = useState(!gateEnabled);
  const [checking, setChecking] = useState(gateEnabled);
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const resolveRef = useRef<((ok: boolean) => void) | null>(null);

  const refreshStatus = useCallback(async () => {
    if (!gateEnabled) {
      setUnlocked(true);
      setChecking(false);
      return;
    }
    try {
      const res = await fetch("/api/site-access/status");
      const data = (await res.json()) as { unlocked?: boolean };
      setUnlocked(Boolean(data.unlocked));
    } catch {
      setUnlocked(false);
    } finally {
      setChecking(false);
    }
  }, [gateEnabled]);

  useEffect(() => {
    void refreshStatus();
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
      window.location.href = href;
    }
  }, []);

  const requestAccess = useCallback(
    (targetHref?: string) => {
      if (!gateEnabled || unlocked) {
        if (targetHref) window.location.href = targetHref;
        return Promise.resolve(true);
      }
      setPendingHref(targetHref ?? null);
      setModalOpen(true);
      return new Promise<boolean>((resolve) => {
        resolveRef.current = resolve;
      });
    },
    [gateEnabled, unlocked]
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
      {gateEnabled && modalOpen ? (
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
              Kleen is not open to the public yet. Enter the preview password to reach the
              sign-in page — you will still sign in with Google after this.
            </p>
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
                  "Continue to sign in"
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
