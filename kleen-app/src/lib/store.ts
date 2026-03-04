import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CleaningType, JobDetail, PaymentMethod, PriceEstimate, RoomSize } from "@/types";
import { calculateEstimate } from "./pricing";

interface JobFlowStore {
  step: number;
  cleaningType: CleaningType | null;
  categoryId: string | null;
  serviceId: string | null;
  details: JobDetail[];
  address: string;
  postcode: string;
  preferredDate: string;
  preferredTime: string;
  estimate: PriceEstimate | null;
  paymentMethodId: string | null;
  savedPaymentMethods: PaymentMethod[];

  setStep: (step: number) => void;
  setCleaningType: (type: CleaningType) => void;
  setCategory: (categoryId: string) => void;
  setService: (serviceId: string) => void;
  addDetail: (detail: JobDetail) => void;
  updateDetail: (index: number, detail: Partial<JobDetail>) => void;
  removeDetail: (index: number) => void;
  setAddress: (address: string) => void;
  setPostcode: (postcode: string) => void;
  setPreferredDate: (date: string) => void;
  setPreferredTime: (time: string) => void;
  setPaymentMethodId: (id: string) => void;
  setSavedPaymentMethods: (methods: PaymentMethod[]) => void;
  addPaymentMethod: (method: PaymentMethod) => void;
  prefill: (data: {
    cleaningType: CleaningType;
    categoryId: string;
    serviceId: string;
    size: RoomSize;
    quantity: number;
    complexity: "standard" | "deep";
    address: string;
    postcode: string;
    preferredTime: string;
  }) => void;
  recalculate: () => void;
  reset: () => void;
}

const initialState = {
  step: 1,
  cleaningType: null as CleaningType | null,
  categoryId: null as string | null,
  serviceId: null as string | null,
  details: [] as JobDetail[],
  address: "",
  postcode: "",
  preferredDate: "",
  preferredTime: "",
  estimate: null as PriceEstimate | null,
  paymentMethodId: null as string | null,
  savedPaymentMethods: [] as PaymentMethod[],
};

export const useJobFlowStore = create<JobFlowStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setStep: (step) => set({ step }),

      setCleaningType: (cleaningType) =>
        set({ cleaningType, categoryId: null, serviceId: null, details: [], estimate: null }),

      setCategory: (categoryId) =>
        set({ categoryId, serviceId: null, details: [], estimate: null }),

      setService: (serviceId) => {
        set({
          serviceId,
          details: [
            {
              serviceId,
              size: "M" as RoomSize,
              quantity: 1,
              complexity: "standard",
            },
          ],
        });
        get().recalculate();
      },

      addDetail: (detail) => {
        set((state) => ({ details: [...state.details, detail] }));
        get().recalculate();
      },

      updateDetail: (index, partial) => {
        set((state) => {
          const details = [...state.details];
          details[index] = { ...details[index], ...partial };
          return { details };
        });
        get().recalculate();
      },

      removeDetail: (index) => {
        set((state) => ({
          details: state.details.filter((_, i) => i !== index),
        }));
        get().recalculate();
      },

      setAddress: (address) => set({ address }),
      setPostcode: (postcode) => set({ postcode }),
      setPreferredDate: (preferredDate) => set({ preferredDate }),
      setPreferredTime: (preferredTime) => set({ preferredTime }),

      setPaymentMethodId: (paymentMethodId) => set({ paymentMethodId }),
      setSavedPaymentMethods: (savedPaymentMethods) => set({ savedPaymentMethods }),
      addPaymentMethod: (method) =>
        set((state) => ({
          savedPaymentMethods: [...state.savedPaymentMethods, method],
          paymentMethodId: method.id,
        })),

      prefill: (data) => {
        set({
          cleaningType: data.cleaningType,
          categoryId: data.categoryId,
          serviceId: data.serviceId,
          details: [
            {
              serviceId: data.serviceId,
              size: data.size,
              quantity: data.quantity,
              complexity: data.complexity,
            },
          ],
          address: data.address,
          postcode: data.postcode,
          preferredTime: data.preferredTime,
          preferredDate: "",
          step: 5,
        });
        get().recalculate();
      },

      recalculate: () => {
        const { details } = get();
        if (details.length > 0) {
          set({ estimate: calculateEstimate(details) });
        } else {
          set({ estimate: null });
        }
      },

      reset: () => set(initialState),
    }),
    {
      name: "kleen-job-flow",
    }
  )
);
