import type { PublicService } from "@/lib/get-shop-catalog";

export const POPULAR_SERVICES_LIMIT = 5;

export function sortServicesByPopularity(
  services: PublicService[]
): PublicService[] {
  return [...services].sort((a, b) => {
    const diff = (b.bookingCount ?? 0) - (a.bookingCount ?? 0);
    if (diff !== 0) return diff;
    return a.name.localeCompare(b.name, "pt-BR");
  });
}

export function groupServicesForBooking(
  services: PublicService[],
  options: { searching?: boolean } = {}
): { popular: PublicService[]; others: PublicService[] } {
  const sorted = sortServicesByPopularity(services);

  if (options.searching) {
    return { popular: [], others: sorted };
  }

  const popular = sorted
    .filter((service) => (service.bookingCount ?? 0) > 0)
    .slice(0, POPULAR_SERVICES_LIMIT);
  const popularIds = new Set(popular.map((service) => service.id));
  const others = sorted.filter((service) => !popularIds.has(service.id));

  return { popular, others };
}
