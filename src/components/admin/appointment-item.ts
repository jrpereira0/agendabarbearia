import type { BookingSource } from "@/lib/booking-source";

export type AppointmentItem = {
  id: string;
  date: string;
  professionalId: string;
  professionalNickname: string;
  /** Id do cliente cadastrado, quando existir. */
  customerId?: string | null;
  customerFirstName: string;
  customerLastName: string;
  customerWhatsapp: string;
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
