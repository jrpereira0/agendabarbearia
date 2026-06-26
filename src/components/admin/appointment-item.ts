export type AppointmentItem = {
  id: string;
  date: string;
  professionalId: string;
  professionalNickname: string;
  customerFirstName: string;
  customerLastName: string;
  customerWhatsapp: string;
  startTime: string;
  endTime: string;
  status:
    | "scheduled"
    | "confirmed"
    | "on_site"
    | "cancelled"
    | "done";
  isSqueezeIn?: boolean;
  isComandaExtra?: boolean;
  services: {
    id: string;
    name: string;
    durationMinutes: number;
    priceCents: number;
  }[];
};
