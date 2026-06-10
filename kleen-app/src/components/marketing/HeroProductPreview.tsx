import {
  Calendar,
  CheckCircle2,
  MapPin,
  Sparkles,
  Truck,
} from "lucide-react";

const STEPS = [
  { label: "Booked", done: true },
  { label: "On the way", done: true, active: true },
  { label: "In progress", done: false },
  { label: "Complete", done: false },
];

export default function HeroProductPreview() {
  return (
    <div className="relative ml-auto w-full max-w-lg lg:max-w-none">
      <div
        className="pointer-events-none absolute -right-4 top-8 hidden rounded-2xl border border-white/80 bg-white px-4 py-3 shadow-lg ring-1 ring-slate-200/60 sm:block"
        aria-hidden="true"
      >
        <p className="text-xs font-medium text-slate-500">Quote ready</p>
        <p className="text-lg font-bold text-brand-600">£124 – £148</p>
      </div>

      <div className="overflow-hidden rounded-[1.25rem] border border-slate-200/80 bg-white ring-1 ring-white/80 sm:rounded-[1.5rem] lg:-mb-16">
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/90 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          <span className="ml-3 text-xs font-medium text-slate-400">dashboard.kleenapp.co.uk</span>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">
                Live job
              </p>
              <h3 className="mt-1 text-lg font-bold text-slate-900">
                End-of-tenancy deep clean
              </h3>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                SW1A 1AA · Today, 2:00pm
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200/80">
              On the way
            </span>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200/70 sm:p-5">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Progress</span>
              <span className="text-brand-600">Step 2 of 4</span>
            </div>
            <div className="relative mt-5 w-full pt-1">
              <div
                className="absolute top-[1.125rem] h-1 rounded-full bg-slate-200"
                style={{ left: "12.5%", right: "12.5%" }}
                aria-hidden="true"
              />
              <div
                className="absolute top-[1.125rem] h-1 rounded-full bg-brand-400"
                style={{ left: "12.5%", width: "25%" }}
                aria-hidden="true"
              />
              <div className="relative grid w-full grid-cols-4">
                {STEPS.map((step, i) => (
                  <div key={step.label} className="flex flex-col items-center gap-2.5">
                    <div
                      className={[
                        "relative z-10 flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold",
                        step.done
                          ? step.active
                            ? "bg-brand-600 text-white shadow-md shadow-brand-600/30 ring-4 ring-brand-600/15"
                            : "bg-brand-100 text-brand-700 ring-4 ring-white"
                          : "bg-white text-slate-400 ring-4 ring-white",
                      ].join(" ")}
                    >
                      {step.done && !step.active ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : step.active ? (
                        <Truck className="h-4 w-4" />
                      ) : (
                        i + 1
                      )}
                    </div>
                    <span
                      className={`w-full text-center text-[10px] font-medium leading-tight sm:text-[11px] ${
                        step.active ? "text-brand-700" : step.done ? "text-brand-600" : "text-slate-400"
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-100 bg-white p-3">
              <div className="flex items-center gap-2 text-slate-500">
                <Calendar className="h-4 w-4 text-brand-500" />
                <span className="text-xs font-medium">Scheduled</span>
              </div>
              <p className="mt-1 text-sm font-semibold text-slate-900">Today · 2 hours</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-white p-3">
              <div className="flex items-center gap-2 text-slate-500">
                <Sparkles className="h-4 w-4 text-brand-500" />
                <span className="text-xs font-medium">Operative</span>
              </div>
              <p className="mt-1 text-sm font-semibold text-slate-900">Sarah M. · 4.9★</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
