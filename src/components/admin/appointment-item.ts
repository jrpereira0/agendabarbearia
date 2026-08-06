import type { BookingSource } from "@/lib/booking-source";

export type AppointmentItem = {
  id: string;
  date: string;
  professionalId: string;
  professionalNickname: string;
  /** Id do cliente cadastrado, quando existir. */
  customerId?: string | null;
  /** Saldo de crédito na loja (centavos), quando o cliente está cadastrado. */
  customerCreditBalanceCents?: number;
  customerFirstName: string;
  customerLastName: string;
  customerWhatsapp: string;
  /** Primeira visita deste cliente (por WhatsApp). */
  isFirstVisit?: boolean;
  startTime: string;
  endTime: string;
  status:
    | "scheduled"
    | "confirmed"
    | "cancelled"
    | "done";
  isSqueezeIn?: boolean;
  isComandaExtra?: boolean;
  /** De onde veio o agendamento (painel, site ou IA). */
  bookingSource?: BookingSource | null;
  services: {
    id: string;
    name: string;
    durationMinutes: number;
    priceCents: number;
  }[];
};
