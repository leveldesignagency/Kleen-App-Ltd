"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useJobFlowStore } from "@/lib/store";
import { getService, getCategory } from "@/lib/services";
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

/* TODO: replace with Supabase query */
const MOCK_SCHEDULES: RecurringSchedule[] = [];

export default function RecurringCleansPage() {
  const router = useRouter();
  const prefill = useJobFlowStore((s) => s.prefill);
  const [schedules, setSchedules] = useState<RecurringSchedule[]>(MOCK_SCHEDULES);

  const togglePause = (id: string) => {
    setSchedules((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, status: s.status === "active" ? "paused" : "active" }
          : s
      )
    );
  };

  const cancelSchedule = (id: string) => {
    setSchedules((prev) => prev.filter((s) => s.id !== id));
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

      {/* Summary pills */}
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
                  {/* Left: info */}
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

                  {/* Right: actions */}
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
                        className="rounded-lg border border-slate-200 p-2 text-slate-400 transition-colors hover:border-slate-300 hover:text-slate-600"
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
                        className="rounded-lg border border-slate-200 p-2 text-slate-400 transition-colors hover:border-red-200 hover:text-red-500"
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
