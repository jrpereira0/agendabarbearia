export const POPULAR_SERVICES_LIMIT = 5;

export type ServiceWithPopularity = {
  id: string;
  name: string;
  bookingCount?: number;
};

function sortServicesAlphabetically<T extends ServiceWithPopularity>(
  services: T[]
): T[] {
  return [...services].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export function sortServicesByPopularity<T extends ServiceWithPopularity>(
  services: T[]
): T[] {
  return [...services].sort((a, b) => {
    const diff = (b.bookingCount ?? 0) - (a.bookingCount ?? 0);
    if (diff !== 0) return diff;
    return a.name.localeCompare(b.name, "pt-BR");
  });
}

export function groupServicesForBooking<T extends ServiceWithPopularity>(
  services: T[],
  options: { searching?: boolean } = {}
): { popular: T[]; others: T[] } {
  if (options.searching) {
    return { popular: [], others: sortServicesAlphabetically(services) };
  }

  const byPopularity = sortServicesByPopularity(services);
  const popular = byPopularity
    .filter((service) => (service.bookingCount ?? 0) > 0)
    .slice(0, POPULAR_SERVICES_LIMIT);
  const popularIds = new Set(popular.map((service) => service.id));
  const others = sortServicesAlphabetically(
    services.filter((service) => !popularIds.has(service.id))
  );

  return { popular, others };
}
