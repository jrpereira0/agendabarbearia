import type { ComandaDetail } from "@/lib/comanda-types";

/** Barbeiro só acessa comanda se participou de algum atendimento ou serviço nela. */
export function barberCanAccessComanda(
  comanda: ComandaDetail,
  professionalId: string
): boolean {
  return (
    comanda.linkedAppointments.some(
      (apt) => apt.professionalId === professionalId
    ) ||
    comanda.items.some((item) => item.professionalId === professionalId) ||
    comanda.professionalId === professionalId
  );
}
