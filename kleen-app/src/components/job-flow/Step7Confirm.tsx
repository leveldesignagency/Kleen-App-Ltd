"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useJobFlowStore } from "@/lib/store";
import { useNotifications } from "@/lib/notifications";
import { useSubmittedJobs } from "@/lib/submitted-jobs";
import { useAddressStore } from "@/lib/addresses";
import { usePaymentMethodStore } from "@/lib/payment-methods";
import { createClient } from "@/lib/supabase/client";
import { getService, getCategory } from "@/lib/services";
import { formatPrice, formatDuration } from "@/lib/pricing";
import {
  buildErrorPresentation,
  createReportId,
  type AppErrorPresentation,
} from "@/lib/app-errors";
import AppErrorModal from "@/components/errors/AppErrorModal";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Clock,
  Loader2,
  Users,
} from "lucide-react";
import CardBrandLogo from "@/components/ui/CardBrandLogo";
import Link from "next/link";
import SparkleButton from "@/components/ui/SparkleButton";

export default function Step7Confirm() {
  const store = useJobFlowStore();
  const router = useRouter();
  const pushNotification = useNotifications((s) => s.push);
  const addSubmittedJob = useSubmittedJobs((s) => s.addJob);
  const addAddressIfNew = useAddressStore((s) => s.addIfNew);
  const addPaymentIfNew = usePaymentMethodStore((s) => s.addIfNew);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<AppErrorPresentation | null>(null);
  const [userEmail, setUserEmail] = useState<string | undefined>();

  const service = getService(store.serviceId || "");
  const category = store.categoryId ? getCategory(store.categoryId) : null;
  const detail = store.details[0];
  const est = store.estimate;

  const paymentMethod = store.savedPaymentMethods.find(
    (m) => m.id === store.paymentMethodId
  );

  if (!est || !service) {
    store.setStep(5);
    return null;
  }

  const errorContext = {
    step: 7,
    serviceId: store.serviceId,
    serviceName: service.name,
    postcode: store.postcode,
    preferredDate: store.preferredDate,
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);

    let supabase;
    try {
      supabase = createClient();
    } catch (e) {
      console.error("Supabase client error:", e);
      setSubmitError(
        buildErrorPresentation(
          { message: e instanceof Error ? e.message : "Could not connect to Kleen" },
          createReportId(),
        ),
      );
      setSubmitting(false);
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session?.access_token) {
      setSubmitError(
        buildErrorPresentation(
          { message: "Your session expired. Please sign out, sign in again, then submit.", code: "42501" },
          createReportId(),
        ),
      );
      setSubmitting(false);
      return;
    }

    setUserEmail(session.user.email || undefined);

    const serviceName = service.name;
    const priceLabel = `${formatPrice(est.minPrice)}–${formatPrice(est.maxPrice)}`;

    let job: { id: string; reference: string };
    try {
      const res = await fetch("/api/jobs/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        credentials: "include",
        body: JSON.stringify({
          serviceId: store.serviceId,
          cleaningType: store.cleaningType,
          address: store.address,
          postcode: store.postcode,
          preferredDate: store.preferredDate,
          preferredTime: store.preferredTime,
          notes: store.details[0]?.notes || null,
          detail: {
            size: detail.size,
            quantity: detail.quantity,
            complexity: detail.complexity,
          },
          estimate: {
            minPrice: est.minPrice,
            maxPrice: est.maxPrice,
            estimatedDuration: est.estimatedDuration,
            operativesRequired: est.operativesRequired,
          },
        }),
      });

      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        jobId?: string;
        reference?: string;
        adminEmailSent?: boolean;
        adminEmailError?: string;
      };

      if (!res.ok || !payload.jobId) {
        console.error("jobs/submit:", res.status, payload);
        setSubmitError(
          buildErrorPresentation(
            { message: payload.error || "Could not submit your job", httpStatus: res.status },
            createReportId(),
          ),
        );
        setSubmitting(false);
        return;
      }

      job = { id: payload.jobId, reference: payload.reference || payload.jobId.slice(0, 8).toUpperCase() };

      if (payload.adminEmailSent === false) {
        console.warn("Admin email not sent:", payload.adminEmailError);
        pushNotification({
          type: "info",
          title: "Job submitted",
          message:
            "Your booking was saved. Admin email alert is delayed — the team will still see your job in the dashboard.",
        });
      }
    } catch (e) {
      console.error("Job submit exception:", e);
      setSubmitError(
        buildErrorPresentation(
          { message: e instanceof Error ? e.message : "Job submission failed" },
          createReportId(),
        ),
      );
      setSubmitting(false);
      return;
    }

    // Also keep in local store for dashboard display
    addSubmittedJob({
      id: job.reference || job.id.slice(0, 8).toUpperCase(),
      service: serviceName,
      status: "pending",
      date: store.preferredDate,
      price: priceLabel,
    });

    if (store.address && store.postcode) {
      addAddressIfNew(supabase, store.address, store.postcode);
    }

    if (paymentMethod) {
      addPaymentIfNew(supabase, paymentMethod);
    }

    store.reset();

    pushNotification({
      type: "success",
      title: "Job Submitted!",
      message: `Your ${serviceName} booking has been received. We'll be in touch shortly.`,
    });

    router.push("/dashboard");
    setSubmitting(false);
  };

  return (
    <>
    <AppErrorModal
      open={!!submitError}
      error={submitError}
      onClose={() => setSubmitError(null)}
      onRetry={handleSubmit}
      context={errorContext}
      userEmail={userEmail}
      page="/job-flow"
    />
    <div>
      <button
        onClick={() => store.setStep(6)}
        className="mb-4 flex items-center gap-1 text-sm text-slate-400 transition-colors hover:text-slate-600"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back
      </button>

      <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Confirm Your Job</h1>
      <p className="mt-1 text-sm text-slate-500">
        Review everything before submitting
      </p>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Left column — job info */}
        <div className="space-y-4">
          <div className="card">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Service
            </h3>
            <p className="mt-1 text-lg font-semibold text-slate-900">{service.name}</p>
            <p className="text-sm text-slate-500">{category?.name} &middot; {store.cleaningType}</p>
          </div>

          <div className="card">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Details
            </h3>
            <div className="mt-2 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Size</span>
                <span className="font-medium text-slate-700">
                  {detail.size === "S" ? "Small" : detail.size === "M" ? "Medium" : "Large"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Areas</span>
                <span className="font-medium text-slate-700">{detail.quantity}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Depth</span>
                <span className="font-medium capitalize text-slate-700">{detail.complexity}</span>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Location & Schedule
            </h3>
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <MapPin className="h-4 w-4 text-slate-400" />
                {store.address}, {store.postcode}
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Calendar className="h-4 w-4 text-slate-400" />
                {new Date(store.preferredDate).toLocaleDateString("en-GB", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Clock className="h-4 w-4 text-slate-400" />
                {store.preferredTime}
              </div>
            </div>
          </div>
        </div>

        {/* Right column — payment & total */}
        <div className="space-y-4">
          {paymentMethod && (
            <div className="card">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Payment
              </h3>
              <div className="mt-2 flex items-center gap-3 text-sm text-slate-600">
                <CardBrandLogo brand={paymentMethod.brand} className="h-6 w-auto rounded" />
                {paymentMethod.label}
              </div>
            </div>
          )}

          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Estimated Quote</h3>
            <div className="rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white p-6">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-slate-900">
                  {formatPrice(est.minPrice)}
                </span>
                <span className="text-lg text-slate-400">&ndash;</span>
                <span className="text-3xl font-bold text-slate-900">
                  {formatPrice(est.maxPrice)}
                </span>
              </div>
              <div className="mt-3 flex gap-4 text-sm text-slate-500">
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDuration(est.estimatedDuration)}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {est.operativesRequired} operative{est.operativesRequired > 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <SparkleButton onClick={handleSubmit} disabled={submitting} className="w-full">
              {submitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting…
                </span>
              ) : (
                "Submit Job"
              )}
            </SparkleButton>

            <p className="text-center text-xs text-slate-400">
              By submitting, you agree to our{" "}
              <Link href="/terms" className="underline hover:text-slate-600">
                Terms of Service
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
