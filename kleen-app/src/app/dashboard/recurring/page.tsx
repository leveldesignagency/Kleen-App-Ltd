"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useJobFlowStore } from "@/lib/store";
import { getService, getCategory } from "@/lib/services";
import { createClient } from "@/lib/supabase/client";
import { CleaningType, RoomSize } from "@/types";
import {
  RefreshCw,
  Plus,
  Pause,
  Play,
  Trash2,
  MapPin,
  Calendar,
  Clock,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

type Frequency = "weekly" | "fortnightly" | "monthly";
type ScheduleStatus = "active" | "paused" | "cancelled";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const FREQ_LABEL: Record<Frequency, string> = {
  weekly: "Every week",
  fortnightly: "Every 2 weeks",
  monthly: "Every month",
};

interface RecurringSchedule {
  id: string;
  templateId: string;
  serviceId: string;
  categoryId: string;
  cleaningType: CleaningType;
  size: RoomSize;
  quantity: number;
  complexity: "standard" | "deep";
  address: string;
  postcode: string;
  frequency: Frequency;
  preferredDay: number;
  preferredTime: string;
  status: ScheduleStatus;
  nextRunDate: string;
  totalRuns: number;
}

export default function RecurringCleansPage() {
  const router = useRouter();
  const supabase = createClient();
  const prefill = useJobFlowStore((s) => s.prefill);
  const [schedules, setSchedules] = useState<RecurringSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const { data: rows } = await supabase
        .from("recurring_schedules")
        .select(`
          id,
          template_id,
          frequency,
          preferred_day,
          preferred_time,
          status,
          next_run_date,
          total_runs,
          job_templates (
            service_id,
            cleaning_type,
            size,
            quantity,
            complexity,
            address_line_1,
            address_line_2,
            city,
            postcode,
            preferred_time
          )
        `)
        .eq("user_id", user.id);
      if (!rows) {
        setLoading(false);
        return;
      }
      const list: RecurringSchedule[] = rows
        .filter((r: { job_templates: unknown }) => r.job_templates)
        .map((r: {
          id: string;
          template_id: string;
          frequency: string;
          preferred_day: number;
          preferred_time: string;
          status: string;
          next_run_date: string;
          total_runs: number;
          job_templates: {
            service_id: string;
            cleaning_type: string;
            size: string;
            quantity: number;
            complexity: string;
            address_line_1: string;
            address_line_2?: string | null;
            city?: string | null;
            postcode: string;
            preferred_time: string;
          };
        }) => {
          const t = r.job_templates;
          const svc = getService(t.service_id);
          return {
            id: r.id,
            templateId: r.template_id,
            serviceId: t.service_id,
            categoryId: svc?.categoryId ?? "",
            cleaningType: t.cleaning_type as CleaningType,
            size: t.size as RoomSize,
            quantity: t.quantity,
            complexity: t.complexity as "standard" | "deep",
            address: [t.address_line_1, t.address_line_2, t.city].filter(Boolean).join(", "),
            postcode: t.postcode,
            frequency: r.frequency as Frequency,
            preferredDay: r.preferred_day,
            preferredTime: (t.preferred_time || r.preferred_time || "09:00").toString().slice(0, 5),
            status: r.status as ScheduleStatus,
            nextRunDate: r.next_run_date,
            totalRuns: r.total_runs,
          };
        });
      setSchedules(list);
      setLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePause = async (id: string) => {
    const s = schedules.find((x) => x.id === id);
    if (!s) return;
    setUpdating(id);
    const newStatus = s.status === "active" ? "paused" : "active";
    await supabase.from("recurring_schedules").update({ status: newStatus }).eq("id", id);
    setSchedules((prev) => prev.map((x) => (x.id === id ? { ...x, status: newStatus } : x)));
    setUpdating(null);
  };

  const cancelSchedule = async (id: string) => {
    setUpdating(id);
    await supabase.from("recurring_schedules").update({ status: "cancelled" }).eq("id", id);
    setSchedules((prev) => prev.filter((s) => s.id !== id));
    setUpdating(null);
  };

  const handleBookNow = (s: RecurringSchedule) => {
    prefill({
      cleaningType: s.cleaningType,
      categoryId: s.categoryId,
      serviceId: s.serviceId,
      size: s.size,
      quantity: s.quantity,
      complexity: s.complexity,
      address: s.address,
      postcode: s.postcode,
      preferredTime: s.preferredTime,
    });
    router.push("/job-flow");
  };

  const activeCount = schedules.filter((s) => s.status === "active").length;
  const pausedCount = schedules.filter((s) => s.status === "paused").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Recurring Cleans</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage your scheduled repeat bookings
          </p>
        </div>
        <button
          onClick={() => router.push("/job-flow")}
          className="btn-primary gap-2"
        >
          <Plus className="h-4 w-4" />
          New Schedule
        </button>
      </div>

      <div className="mt-6 flex gap-3">
        <div className="flex items-center gap-2 rounded-full bg-accent-50 px-4 py-2">
          <CheckCircle2 className="h-4 w-4 text-accent-600" />
          <span className="text-sm font-medium text-accent-700">{activeCount} Active</span>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2">
          <Pause className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-600">{pausedCount} Paused</span>
        </div>
      </div>

      {schedules.length === 0 ? (
        <div className="mt-12 flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50">
            <RefreshCw className="h-7 w-7 text-brand-500" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-slate-900">No recurring cleans yet</h2>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            After you complete a job, you can set it up to repeat automatically. No more manual rebooking.
          </p>
          <button
            onClick={() => router.push("/job-flow")}
            className="btn-primary mt-6 gap-2"
          >
            Book Your First Clean
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {schedules.map((schedule) => {
            const service = getService(schedule.serviceId);
            const category = getCategory(schedule.categoryId);
            const isActive = schedule.status === "active";
            const busy = updating === schedule.id;

            return (
              <div
                key={schedule.id}
                className={`rounded-2xl border bg-white p-5 transition-all ${
                  isActive
                    ? "border-slate-200"
                    : "border-dashed border-slate-300 opacity-75"
                }`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isActive ? "bg-brand-50" : "bg-slate-100"}`}>
                        <RefreshCw className={`h-4.5 w-4.5 ${isActive ? "text-brand-600" : "text-slate-400"}`} />
                      </div>
                      <div>
                        <p className="text-base font-semibold text-slate-900">
                          {service?.name}
                        </p>
                        <p className="text-xs text-slate-400">
                          {category?.name} &middot;{" "}
                          {schedule.complexity === "deep" ? "Deep" : "Standard"} &middot;{" "}
                          {schedule.size === "S" ? "Small" : schedule.size === "M" ? "Medium" : "Large"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <RefreshCw className="h-3 w-3 text-slate-400" />
                        {FREQ_LABEL[schedule.frequency]}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-slate-400" />
                        {DAYS[schedule.preferredDay]}s
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-slate-400" />
                        {schedule.preferredTime}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-slate-400" />
                        {schedule.address}, {schedule.postcode}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center gap-3 text-xs">
                      <span className={`rounded-full px-2.5 py-1 font-medium ${isActive ? "bg-accent-100 text-accent-700" : "bg-slate-100 text-slate-500"}`}>
                        {isActive ? "Active" : "Paused"}
                      </span>
                      <span className="text-slate-400">
                        {schedule.totalRuns} completed &middot; Next:{" "}
                        {isActive
                          ? new Date(schedule.nextRunDate).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                            })
                          : "—"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                    <button
                      onClick={() => handleBookNow(schedule)}
                      className="flex items-center gap-1.5 rounded-xl bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-700 transition-all hover:bg-brand-100"
                    >
                      Book Now
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                    <div className="flex gap-2">
                      <button
                        onClick={() => togglePause(schedule.id)}
                        disabled={busy}
                        className="rounded-lg border border-slate-200 p-2 text-slate-400 transition-colors hover:border-slate-300 hover:text-slate-600 disabled:opacity-50"
                        title={isActive ? "Pause" : "Resume"}
                      >
                        {isActive ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => cancelSchedule(schedule.id)}
                        disabled={busy}
                        className="rounded-lg border border-slate-200 p-2 text-slate-400 transition-colors hover:border-red-200 hover:text-red-500 disabled:opacity-50"
                        title="Cancel schedule"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
