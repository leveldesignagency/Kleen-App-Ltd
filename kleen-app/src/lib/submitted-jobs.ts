import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface SubmittedJob {
  id: string;
  service: string;
  status: "pending" | "quoted" | "accepted" | "in_progress" | "completed" | "disputed" | "cancelled";
  date: string;
  price: string;
}

interface SubmittedJobsStore {
  jobs: SubmittedJob[];
  addJob: (job: SubmittedJob) => void;
  clear: () => void;
}

export const useSubmittedJobs = create<SubmittedJobsStore>()(
  persist(
    (set) => ({
      jobs: [],
      addJob: (job) => set((s) => ({ jobs: [job, ...s.jobs] })),
      clear: () => set({ jobs: [] }),
    }),
    { name: "kleen-submitted-jobs" }
  )
);
