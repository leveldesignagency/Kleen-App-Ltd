import { create } from "zustand";

export interface AdminJob {
  id: string;
  reference: string;
  service: string;
  cleaning_type: string;
  status: string;
  cancelled_reason?: string;
  user_id?: string;
  customer_name: string;
  customer_email: string;
  address: string;
  postcode: string;
  date: string;
  time: string;
  price_estimate: number;
  rooms: number;
  operatives: number;
  complexity: string;
  notes?: string;
  created_at: string;
  is_blocked?: boolean;
  /** Set when customer payment is captured — funds are in your Stripe account */
  payment_captured_at?: string | null;
  /** Set when admin has released funds to the contractor (17.5% kept) */
  funds_released_at?: string | null;
  accepted_quote_request_id?: string | null;
}

export type ContractorType = "sole_trader" | "business";

export interface Contractor {
  id: string;
  user_id?: string;
  full_name: string;
  email: string;
  phone: string;
  contractor_type: ContractorType;
  company_name?: string;
  specialisations: string[];
  service_areas: string[];
  rating: number;
  total_jobs: number;
  hourly_rate?: number;
  is_active: boolean;
  is_verified: boolean;
  notes?: string;
  bank_account_name?: string;
  bank_sort_code?: string;
  bank_account_number?: string;
  company_number?: string;
  vat_number?: string;
  utr_number?: string;
  stripe_account_id?: string;
  created_at: string;
}

export interface QuoteRequest {
  id: string;
  job_id: string;
  operative_id: string;
  operative_name: string;
  status: "sent" | "viewed" | "quoted" | "declined" | "expired";
  deadline: string;
  message?: string;
  sent_at: string;
  viewed_at?: string;
  responded_at?: string;
  quote_response?: QuoteResponse;
}

export interface QuoteResponse {
  id: string;
  quote_request_id: string;
  price_pence: number;
  customer_price_pence?: number;
  estimated_hours: number;
  available_date?: string;
  arrival_time?: string;
  notes?: string;
  created_at: string;
}

interface AdminStore {
  jobs: AdminJob[];
  contractors: Contractor[];
  quoteRequests: QuoteRequest[];
  setJobs: (jobs: AdminJob[]) => void;
  setContractors: (contractors: Contractor[]) => void;
  setQuoteRequests: (qr: QuoteRequest[]) => void;
  addJob: (job: AdminJob) => void;
  updateJob: (id: string, updates: Partial<AdminJob>) => void;
  addContractor: (c: Contractor) => void;
  updateContractor: (id: string, updates: Partial<Contractor>) => void;
  removeContractor: (id: string) => void;
  addQuoteRequest: (qr: QuoteRequest) => void;
  updateQuoteRequest: (id: string, updates: Partial<QuoteRequest>) => void;
}

export const useAdminStore = create<AdminStore>((set) => ({
  jobs: [],
  contractors: [],
  quoteRequests: [],

  setJobs: (jobs) => set({ jobs }),
  setContractors: (contractors) => set({ contractors }),
  setQuoteRequests: (quoteRequests) => set({ quoteRequests }),

  addJob: (job) => set((s) => ({ jobs: [job, ...s.jobs] })),
  updateJob: (id, updates) =>
    set((s) => ({
      jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...updates } : j)),
    })),

  addContractor: (c) => set((s) => ({ contractors: [c, ...s.contractors] })),
  updateContractor: (id, updates) =>
    set((s) => ({
      contractors: s.contractors.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    })),
  removeContractor: (id) =>
    set((s) => ({ contractors: s.contractors.filter((c) => c.id !== id) })),

  addQuoteRequest: (qr) =>
    set((s) => ({ quoteRequests: [qr, ...s.quoteRequests] })),
  updateQuoteRequest: (id, updates) =>
    set((s) => ({
      quoteRequests: s.quoteRequests.map((qr) =>
        qr.id === id ? { ...qr, ...updates } : qr
      ),
    })),
}));
