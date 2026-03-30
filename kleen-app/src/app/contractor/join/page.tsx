"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Loader2, ArrowRight } from "lucide-react";

const EMAIL_AUTH_ENABLED = process.env.NEXT_PUBLIC_ENABLE_EMAIL_AUTH === "true";

export default function ContractorJoinPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    if (!EMAIL_AUTH_ENABLED) {
      setError("Email sign-up is not enabled on this environment. Contact Kleen to be onboarded.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          role: "operative",
        },
      },
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setInfo("If email confirmation is required, check your inbox — then sign in at the link below.");
    setFullName("");
    setEmail("");
    setPassword("");
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 py-16">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex justify-center">
          <Image src="/images/kleen-logo.svg" alt="KLEEN" width={160} height={66} className="h-12 w-auto" />
        </Link>
        <h1 className="text-center text-2xl font-bold text-slate-900">Become a Kleen contractor</h1>
        <p className="mt-2 text-center text-sm text-slate-600">
          Create an account with the <strong>contractor</strong> role. After sign-in you will add company details,
          services, and (once Kleen has verified you in the admin app) Stripe for payouts.
        </p>
        <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-xs text-slate-600">
          New accounts stay <strong>pending</strong> until Kleen approves you under <strong>Contractors</strong> in the
          admin dashboard. You can complete profile and services while you wait; jobs and payouts unlock after approval.
        </p>

        {!EMAIL_AUTH_ENABLED ? (
          <p className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Email registration is disabled here. Ask Kleen to enable <code className="text-xs">NEXT_PUBLIC_ENABLE_EMAIL_AUTH</code> or
            invite you via the team.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Full name</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
                required
              />
            </div>
            {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}
            {info && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{info}</p>}
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Create contractor account
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-slate-500">
          Already registered?{" "}
          <Link href="/contractor/sign-in" className="font-medium text-brand-600 hover:text-brand-700">
            Contractor sign in
          </Link>
        </p>
        <p className="mt-2 text-center text-sm text-slate-500">
          Customer?{" "}
          <Link href="/sign-in" className="font-medium text-brand-600 hover:text-brand-700">
            Customer sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
