"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { isSiteAccessGateEnabledPublic } from "@/lib/site-access-gate-public";

type Props = {
  children: React.ReactNode;
};

export default function SiteAccessGate({ children }: Props) {
  const gateEnabled = isSiteAccessGateEnabledPublic();
  const [unlocked, setUnlocked] = useState(!gateEnabled);
  const [checking, setChecking] = useState(gateEnabled);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const checkAccess = useCallback(async () => {
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
    void checkAccess();
  }, [checkAccess]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
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
    } catch {
      setError("Could not verify access");
    } finally {
      setLoading(false);
    }
  };

  if (!gateEnabled) return <>{children}</>;

  if (checking) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (unlocked) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/95 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-8 shadow-2xl">
        <div className="mb-6 flex items-center justify-center gap-2 text-brand-400">
          <Lock className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-widest">Private preview</span>
        </div>
        <h2 className="text-center text-xl font-bold text-white">Access required</h2>
        <p className="mt-2 text-center text-sm text-slate-400">
          Sign-in is restricted while Kleen is in private preview.
        </p>
        <form onSubmit={handleUnlock} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300">Username</label>
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
            <label className="block text-sm font-medium text-slate-300">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field mt-1 bg-slate-800 text-white"
              autoComplete="current-password"
              required
            />
          </div>
          {error && (
            <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-400">{error}</p>
          )}
          <button type="submit" disabled={loading} className="btn-primary w-full py-3">
            {loading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Unlock"}
          </button>
        </form>
      </div>
    </div>
  );
}
