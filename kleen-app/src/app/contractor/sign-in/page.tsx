"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, ArrowRight } from "lucide-react";

const EMAIL_AUTH_ENABLED = process.env.NEXT_PUBLIC_ENABLE_EMAIL_AUTH === "true";

export default function ContractorSignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!EMAIL_AUTH_ENABLED) {
      setError("Email sign-in is not enabled on this environment.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      setLoading(false);
      setError(err.message);
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user?.id || "").maybeSingle();
    setLoading(false);
    if (profile?.role !== "operative") {
      await supabase.auth.signOut();
      setError("This account is not a contractor account. Use the customer sign-in or register as a contractor.");
      return;
    }
    router.push("/contractor");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 py-16">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex justify-center">
          <Image src="/images/kleen-logo.svg" alt="KLEEN" width={160} height={66} className="h-12 w-auto" />
        </Link>
        <h1 className="text-center text-2xl font-bold text-slate-900">Contractor sign in</h1>
        <p className="mt-2 text-center text-sm text-slate-600">For Kleen cleaning contractors only.</p>

        {!EMAIL_AUTH_ENABLED ? (
          <p className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Email sign-in is disabled. Enable <code className="text-xs">NEXT_PUBLIC_ENABLE_EMAIL_AUTH</code> or contact Kleen.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
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
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
                required
              />
            </div>
            {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Sign in
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-slate-500">
          New contractor?{" "}
          <Link href="/contractor/join" className="font-medium text-brand-600 hover:text-brand-700">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
