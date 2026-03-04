import { JobDetail, PriceEstimate, RoomSize } from "@/types";
import { getService } from "./services";

const SIZE_MULTIPLIER: Record<RoomSize, number> = {
  S: 0.75,
  M: 1.0,
  L: 1.5,
};

const COMPLEXITY_MULTIPLIER = {
  standard: 1.0,
  deep: 1.4,
};

export function calculateEstimate(details: JobDetail[]): PriceEstimate {
  let subtotal = 0;
  let totalMinutes = 0;

  for (const detail of details) {
    const service = getService(detail.serviceId);
    if (!service) continue;

    const sizeMulti = SIZE_MULTIPLIER[detail.size];
    const complexityMulti = COMPLEXITY_MULTIPLIER[detail.complexity];
    const quantity = Math.max(1, detail.quantity);

    const itemPrice =
      (service.basePrice + service.pricePerUnit * (quantity - 1)) *
      sizeMulti *
      complexityMulti;

    const itemMinutes = service.estimatedMinutes * sizeMulti * complexityMulti;

    subtotal += itemPrice;
    totalMinutes += itemMinutes;
  }

  const variance = 0.15;
  const minPrice = Math.round(subtotal * (1 - variance));
  const maxPrice = Math.round(subtotal * (1 + variance));

  const operativesRequired =
    totalMinutes > 480 ? 3 : totalMinutes > 240 ? 2 : 1;

  const adjustedDuration = Math.round(totalMinutes / operativesRequired);

  return {
    subtotal: Math.round(subtotal),
    minPrice,
    maxPrice,
    estimatedDuration: adjustedDuration,
    operativesRequired,
  };
}

export function formatPrice(pence: number): string {
  return `£${pence.toFixed(0)}`;
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}min`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}min`;
}
