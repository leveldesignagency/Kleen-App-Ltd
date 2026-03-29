"use client";

import { useEffect, useState } from "react";
import { useJobFlowStore } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";
import { useUserProfile } from "@/lib/user-profile";
import Step1Auth from "@/components/job-flow/Step1Auth";
import Step2Type from "@/components/job-flow/Step2Type";
import Step3Service from "@/components/job-flow/Step3Service";
import Step4Details from "@/components/job-flow/Step4Details";
import Step5Estimate from "@/components/job-flow/Step5Estimate";
import Step6Payment from "@/components/job-flow/Step6Payment";
import Step7Confirm from "@/components/job-flow/Step7Confirm";
import Link from "next/link";
import Image from "next/image";
import { X } from "lucide-react";

const STEPS = ["Sign In", "Type", "Service", "Details", "Quote", "Payment", "Confirm"];

export default function JobFlowPage() {
  const step = useJobFlowStore((s) => s.step);
  const setStep = useJobFlowStore((s) => s.setStep);
  const setProfile = useUserProfile((s) => s.setProfile);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const applyUser = (user: {
      email?: string | null;
      user_metadata?: Record<string, unknown>;
    }) => {
      setProfile({
        email: user.email || "",
        fullName:
          (user.user_metadata?.full_name as string) ||
          (user.user_metadata?.name as string) ||
          "",
      });
      if (useJobFlowStore.getState().step === 1) {
        setStep(2);
      }
    };

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled) return;
      if (user) applyUser(user);
      setAuthChecked(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "SIGNED_IN" && session?.user) {
        applyUser(session.user);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [setStep, setProfile]);

  if (!authChecked) return null;

  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-br from-slate-900 via-brand-950 to-slate-900">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(6,182,212,0.12),_transparent_60%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(16,185,129,0.08),_transparent_60%)] pointer-events-none" />

      {/* Minimal header */}
      <header className="relative z-10 flex items-center justify-between px-5 pt-4 pb-2 sm:px-8">
        <Link href="/" className="flex items-center">
          <Image
            src="/images/kleen-logo.svg"
            alt="KLEEN"
            width={100}
            height={42}
            className="h-8 w-auto brightness-0 invert opacity-80"
            priority
          />
        </Link>
        <Link
          href="/"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/60 transition-colors hover:bg-white/20 hover:text-white"
        >
          <X className="h-4 w-4" />
        </Link>
      </header>

      {/* Step title */}
      <div className="relative z-10 px-5 pb-4 pt-2 sm:px-8">
        <p className="text-xs font-medium uppercase tracking-widest text-brand-400/80">
          Step {step} of {STEPS.length}
        </p>
      </div>

      {/* Content area */}
      <main className="relative z-10 flex flex-1 flex-col px-3 pb-24 sm:px-6 lg:px-10">
        <div className="mx-auto w-full max-w-lg flex-1 sm:max-w-2xl lg:max-w-4xl">
          <div className="rounded-3xl bg-white p-5 shadow-2xl shadow-black/20 sm:p-8 lg:p-10">
            {step === 1 && <Step1Auth />}
            {step === 2 && <Step2Type />}
            {step === 3 && <Step3Service />}
            {step === 4 && <Step4Details />}
            {step === 5 && <Step5Estimate />}
            {step === 6 && <Step6Payment />}
            {step === 7 && <Step7Confirm />}
          </div>
        </div>
      </main>

      {/* Bottom step dots */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 flex items-center justify-center gap-2 bg-gradient-to-t from-slate-900/90 to-transparent pb-5 pt-8">
        {STEPS.map((label, i) => {
          const num = i + 1;
          const done = num < step;
          const current = num === step;
          return (
            <div key={label} className="flex flex-col items-center gap-1">
              <div
                className={`rounded-full transition-all duration-300 ${
                  current
                    ? "h-2.5 w-2.5 bg-brand-400 shadow-md shadow-brand-400/50"
                    : done
                    ? "h-2 w-2 bg-brand-400/60"
                    : "h-2 w-2 bg-white/20"
                }`}
              />
            </div>
          );
        })}
      </nav>
    </div>
  );
}
