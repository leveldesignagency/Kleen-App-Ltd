"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, ShieldCheck } from "lucide-react";
import Image from "next/image";

type MfaStep = "password" | "totp";

export default function AdminLoginPage() {
  const [step, setStep] = useState<MfaStep>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const finishLogin = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Authentication failed");
      return false;
    }

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (!profile || profile.role !== "admin") {
      await supabase.auth.signOut();
      setError("Access denied. Admin credentials required.");
      return false;
    }
    return true;
  }, []);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const totpFactor = factors?.totp?.find((f) => f.status === "verified");

    if (totpFactor && aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: totpFactor.id,
      });
      if (challengeError || !challenge) {
        setError(challengeError?.message || "Could not start authenticator challenge.");
        setLoading(false);
        return;
      }
      setFactorId(totpFactor.id);
      setChallengeId(challenge.id);
      setStep("totp");
      setLoading(false);
      return;
    }

    const ok = await finishLogin();
    setLoading(false);
    if (ok) {
      window.location.href = "/";
    }
  };

  const handleTotpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId || !challengeId) return;
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId,
      code: totpCode.trim(),
    });

    if (verifyError) {
      setError(verifyError.message);
      setLoading(false);
      return;
    }

    const ok = await finishLogin();
    setLoading(false);
    if (ok) {
      window.location.href = "/";
    }
  };

  useEffect(() => {
    const supabase = createClient();
    void (async () => {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totpFactor = factors?.totp?.find((f) => f.status === "verified");
      if (totpFactor && aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
        const { data: challenge } = await supabase.auth.mfa.challenge({ factorId: totpFactor.id });
        if (challenge) {
          setFactorId(totpFactor.id);
          setChallengeId(challenge.id);
          setStep("totp");
        }
      }
    })();
  }, []);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-950 px-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(6,182,212,0.08),_transparent_60%)] pointer-events-none" />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <Image
            src="/images/kleen-logo.svg"
            alt="KLEEN"
            width={120}
            height={50}
            className="mx-auto h-10 w-auto brightness-0 invert opacity-70"
          />
          <div className="mt-4 flex items-center justify-center gap-2">
            <ShieldCheck className="h-4 w-4 text-brand-400" />
            <span className="text-xs font-semibold uppercase tracking-widest text-brand-400">
              Staff Portal
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm">
          <h1 className="text-xl font-bold text-white">
            {step === "totp" ? "Authenticator code" : "Sign in"}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {step === "totp"
              ? "Enter the 6-digit code from your authenticator app."
              : "Authorised personnel only"}
          </p>

          {step === "password" ? (
            <form onSubmit={handlePasswordSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 py-3 px-4 text-sm text-white outline-none focus:border-brand-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 py-3 px-4 text-sm text-white outline-none focus:border-brand-500"
                  required
                />
              </div>
              {error && <p className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleTotpSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400">Authenticator code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 py-3 px-4 text-sm tracking-widest text-white outline-none focus:border-brand-500"
                  required
                />
              </div>
              {error && <p className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={loading || totpCode.length < 6}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & continue"}
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-600">
          Protected by Supabase Auth + optional TOTP MFA
        </p>
      </div>
    </div>
  );
}
