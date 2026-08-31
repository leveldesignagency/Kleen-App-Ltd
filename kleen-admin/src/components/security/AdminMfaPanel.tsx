"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, ShieldCheck, Smartphone } from "lucide-react";

export default function AdminMfaPanel() {
  const [loading, setLoading] = useState(true);
  const [enrolled, setEnrolled] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError) {
      setError(listError.message);
      setLoading(false);
      return;
    }
    const verified = factors?.totp?.some((f) => f.status === "verified") ?? false;
    setEnrolled(verified);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const startEnroll = async () => {
    setEnrolling(true);
    setError(null);
    const supabase = createClient();
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Kleen admin",
    });
    if (enrollError || !data) {
      setError(enrollError?.message || "Could not start MFA enrollment.");
      setEnrolling(false);
      return;
    }
    setFactorId(data.id);
    setQr(data.totp.qr_code);
    setSecret(data.totp.secret);
    setEnrolling(false);
  };

  const confirmEnroll = async () => {
    if (!factorId) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError || !challenge) {
      setError(challengeError?.message || "Challenge failed.");
      setBusy(false);
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: code.trim(),
    });
    setBusy(false);
    if (verifyError) {
      setError(verifyError.message);
      return;
    }
    setQr(null);
    setSecret(null);
    setCode("");
    setFactorId(null);
    await refresh();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-6 w-6 animate-spin text-brand-400" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <div className="flex items-center gap-2">
        <Smartphone className="h-4 w-4 text-brand-400" />
        <h2 className="text-sm font-semibold text-white">Two-factor authentication (TOTP)</h2>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-400">
        Staff accounts should enroll an authenticator app (Google Authenticator, 1Password, etc.). After enrollment,
        each sign-in requires your password plus a 6-digit code.
      </p>

      {enrolled ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          Authenticator enrolled on this account.
        </div>
      ) : qr ? (
        <div className="mt-4 space-y-4">
          <p className="text-xs text-slate-400">Scan this QR code, then enter the 6-digit code to confirm.</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="TOTP QR code" className="mx-auto h-40 w-40 rounded-lg bg-white p-2" />
          {secret && (
            <p className="text-center font-mono text-xs text-slate-500">
              Manual key: <span className="text-slate-300">{secret}</span>
            </p>
          )}
          <input
            type="text"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="6-digit code"
            className="w-full max-w-xs rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm tracking-widest text-white"
          />
          <button
            type="button"
            onClick={() => void confirmEnroll()}
            disabled={busy || code.length < 6}
            className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
          >
            {busy ? "Confirming…" : "Confirm authenticator"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void startEnroll()}
          disabled={enrolling}
          className="mt-4 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/5 disabled:opacity-50"
        >
          {enrolling ? "Preparing…" : "Set up authenticator"}
        </button>
      )}

      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
    </div>
  );
}
