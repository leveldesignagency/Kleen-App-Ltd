import { Check, Circle, MapPin, Navigation, Wrench, AlertCircle } from "lucide-react";

export type JobActivityModel = {
  status: string;
  preferred_date: string | null;
  hasAcceptedQuote: boolean;
  actual_start: string | null;
  operative_en_route_at: string | null;
  operative_arrived_at: string | null;
  operative_marked_complete_at: string | null;
  operative_marked_incomplete_at: string | null;
  operative_incomplete_reason: string | null;
  contractor_confirmed_complete_at: string | null;
  customer_confirmed_complete_at: string | null;
};

function timeShort(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

type Step = { key: string; label: string; sub: string; done: boolean; icon: "nav" | "pin" | "wrench" | "alert" | "check" };

function buildSteps(job: JobActivityModel): Step[] {
  const out: Step[] = [];
  const s = job.status;
  const early = ["pending", "awaiting_quotes", "quotes_received", "quoted", "sent_to_customer"].includes(s);

  out.push({
    key: "booked",
    label: "Booked",
    sub: job.preferred_date
      ? new Date(job.preferred_date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
      : "Date to be agreed",
    done: job.hasAcceptedQuote && !early,
    icon: "check",
  });

  if (early && !job.hasAcceptedQuote) {
    return out;
  }

  out.push({
    key: "enroute",
    label: "On the way",
    sub: job.operative_en_route_at
      ? timeShort(job.operative_en_route_at)
      : "You’ll see a time when your professional is travelling to you",
    done: Boolean(job.operative_en_route_at),
    icon: "nav",
  });

  out.push({
    key: "arrived",
    label: "Arrived on site",
    sub: job.operative_arrived_at
      ? timeShort(job.operative_arrived_at)
      : "They’ll mark arrival when they reach the address",
    done: Boolean(job.operative_arrived_at),
    icon: "pin",
  });

  const inProg =
    Boolean(job.actual_start) ||
    s === "in_progress" ||
    Boolean(job.operative_marked_complete_at) ||
    ["pending_confirmation", "completed", "funds_released"].includes(s);
  out.push({
    key: "progress",
    label: "In progress",
    sub: job.actual_start ? `Started around ${timeShort(job.actual_start)}` : "Work is carried out on site",
    done: inProg,
    icon: "wrench",
  });

  if (job.operative_marked_incomplete_at) {
    out.push({
      key: "issue",
      label: "Issue reported",
      sub: job.operative_incomplete_reason || "Kleen or your contractor may contact you",
      done: true,
      icon: "alert",
    });
  }

  if (job.operative_marked_complete_at) {
    out.push({
      key: "op_done",
      label: "Finished on site",
      sub: timeShort(job.operative_marked_complete_at),
      done: true,
      icon: "check",
    });
  }

  const closed = s === "completed" || s === "funds_released";
  const both =
    Boolean(job.contractor_confirmed_complete_at) && Boolean(job.customer_confirmed_complete_at);
  out.push({
    key: "wrap",
    label: closed && s === "funds_released" ? "Job closed" : closed ? "Complete" : "Confirm completion",
    sub: (() => {
      if (s === "funds_released") return "Payment has been processed per your agreement";
      if (s === "completed" && both) return "Kleen will release payment after the review window";
      if (job.customer_confirmed_complete_at && !job.contractor_confirmed_complete_at)
        return "Waiting for the other party to confirm";
      if (job.contractor_confirmed_complete_at && !job.customer_confirmed_complete_at) return "Please confirm you’re happy";
      if (["pending_confirmation", "completed", "funds_released"].includes(s) || both) return "Wrap-up and payment";
      return "After the work, you’ll confirm here";
    })(),
    done: ["completed", "funds_released"].includes(s) || both,
    icon: "check",
  });

  return out;
}

function StepIcon({ step, isActive }: { step: Step; isActive: boolean }) {
  if (step.done) {
    if (step.icon === "alert")
      return (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-amber-800">
          <AlertCircle className="h-3.5 w-3.5" />
        </span>
      );
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-600 text-white">
        <Check className="h-3.5 w-3.5" />
      </span>
    );
  }
  const base = isActive
    ? "bg-cyan-200 text-cyan-900 ring-2 ring-cyan-400/60"
    : "bg-slate-100 text-slate-400";
  const Icon = step.icon === "nav" ? Navigation : step.icon === "pin" ? MapPin : step.icon === "wrench" ? Wrench : Circle;
  return (
    <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs ${base}`}>
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}

export function JobActivityTimeline({ job }: { job: JobActivityModel }) {
  if (!job.hasAcceptedQuote || job.status === "cancelled" || job.status === "disputed") return null;

  const steps = buildSteps(job);
  const firstIncomplete = steps.findIndex((t) => !t.done);
  const activeIndex = firstIncomplete === -1 ? steps.length - 1 : firstIncomplete;

  return (
    <div className="rounded-2xl border border-cyan-200/80 bg-gradient-to-b from-cyan-50/90 to-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-cyan-950">Live job activity</h2>
          <p className="mt-1 text-xs text-cyan-800/80">
            Driver / cleaner status updates in real time when you keep this page open. On the way and arrived appear when
            your professional uses their link.
          </p>
        </div>
        <span className="mt-0.5 inline-flex h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-500" title="Listening for updates" />
      </div>
      <ol className="mt-4">
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1;
          const isActive = i === activeIndex;
          return (
            <li key={step.key} className="relative flex gap-3">
              <div className="flex w-5 flex-col items-center">
                <StepIcon step={step} isActive={!step.done && isActive} />
                {!isLast && (
                  <span className={`my-0.5 min-h-[1.5rem] w-0.5 flex-1 ${step.done ? "bg-cyan-300" : "bg-slate-200"}`} />
                )}
              </div>
              <div className={`min-w-0 flex-1 ${isLast ? "pb-0" : "pb-4"}`}>
                <p
                  className={`text-sm font-medium ${
                    isActive && !step.done ? "text-cyan-900" : step.done ? "text-slate-900" : "text-slate-400"
                  }`}
                >
                  {step.label}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">{step.sub}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
