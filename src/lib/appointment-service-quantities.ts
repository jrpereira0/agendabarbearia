/** Contagens de serviço em agendamentos (ex.: 2× o mesmo corte). */

export function countServiceQuantities(
  serviceIds: string[]
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const id of serviceIds) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

export function uniqueServiceIds(serviceIds: string[]): string[] {
  return [...new Set(serviceIds)];
}

/** Linhas para insert em appointment_services (um row por serviço + quantity). */
export function appointmentServiceRowsFromIds(
  appointmentId: string,
  serviceIds: string[]
): { appointment_id: string; service_id: string; quantity: number }[] {
  return [...countServiceQuantities(serviceIds).entries()].map(
    ([service_id, quantity]) => ({
      appointment_id: appointmentId,
      service_id,
      quantity,
    })
  );
}

/** Expande quantity → lista com IDs repetidos (UI e totais). */
export function expandServiceIdsFromRows(
  rows: { service_id: string; quantity?: number | null }[]
): string[] {
  const out: string[] = [];
  for (const row of rows) {
    const quantity = Math.max(1, row.quantity ?? 1);
    for (let i = 0; i < quantity; i += 1) {
      out.push(row.service_id);
    }
  }
  return out;
}

export function sumDurationForServiceIds(
  serviceIds: string[],
  durationById: Map<string, number>
): number {
  return serviceIds.reduce(
    (sum, id) => sum + (durationById.get(id) ?? 0),
    0
  );
}
