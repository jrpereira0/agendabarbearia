import { weekdayOf } from "@/lib/availability";
import { serviceMatchesDateBand } from "@/lib/catalog-booking";
import { formatPriceBRL } from "@/lib/format";
import type { PublicService } from "@/lib/get-shop-catalog";
import { groupWeekdayPrices, priceForWeekday } from "@/lib/service-weekday-prices";

export function priceOnWeekdayForPublicService(
  service: PublicService,
  weekday: number
): number | null {
  if (service.weekdayPrices.length > 0) {
    return priceForWeekday(service.weekdayPrices, weekday);
  }
  return serviceMatchesDateBand(service.name, weekday)
    ? service.priceCents
    : null;
}

export function publicServicePriceCents(
  service: PublicService,
  date?: string
): number {
  if (date) {
    const dayPrice = priceOnWeekdayForPublicService(service, weekdayOf(date));
    if (dayPrice !== null) return dayPrice;
  }
  return service.priceCents;
}

function weekdayBandLabel(weekdays: number[]): string | null {
  const sorted = [...weekdays].sort((a, b) => a - b);
  if (sorted.length === 3 && sorted[0] === 1 && sorted[2] === 3) {
    return "Seg–Qua";
  }
  if (sorted.length === 3 && sorted[0] === 4 && sorted[2] === 6) {
    return "Qui–Sáb";
  }
  return null;
}

export function hasVariablePublicServicePrice(service: PublicService): boolean {
  if (service.weekdayPrices.length === 0) return false;
  const amounts = new Set(service.weekdayPrices.map((row) => row.priceCents));
  return amounts.size > 1;
}

export function formatPublicServicePriceLabel(
  service: PublicService,
  date?: string
): string {
  if (date) {
    return formatPriceBRL(publicServicePriceCents(service, date));
  }

  if (service.weekdayPrices.length > 0) {
    const groups = groupWeekdayPrices(service.weekdayPrices);
    const uniqueAmounts = new Set(groups.map(([cents]) => cents));

    if (uniqueAmounts.size === 1) {
      return formatPriceBRL(groups[0][0]);
    }

    if (
      groups.length === 2 &&
      groups.every(([, weekdays]) => weekdayBandLabel(weekdays) !== null)
    ) {
      return groups
        .map(([cents, weekdays]) => {
          const band = weekdayBandLabel(weekdays)!;
          return `${band} ${formatPriceBRL(cents)}`;
        })
        .join(" · ");
    }

    const min = Math.min(...groups.map(([cents]) => cents));
    const max = Math.max(...groups.map(([cents]) => cents));
    return `${formatPriceBRL(min)} – ${formatPriceBRL(max)}`;
  }

  return formatPriceBRL(service.priceCents);
}

export function sumPublicServicesPriceCents(
  services: PublicService[],
  date?: string
): number {
  return services.reduce(
    (sum, service) => sum + publicServicePriceCents(service, date),
    0
  );
}

export function formatPublicServicesTotalLabel(
  services: PublicService[],
  date?: string
): string {
  const total = sumPublicServicesPriceCents(services, date);
  if (!date && services.some(hasVariablePublicServicePrice)) {
    return `a partir de ${formatPriceBRL(total)}`;
  }
  return formatPriceBRL(total);
}
