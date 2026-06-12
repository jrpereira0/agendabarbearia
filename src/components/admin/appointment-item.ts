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
  status: "confirmed" | "cancelled" | "done";
  isSqueezeIn?: boolean;
  services: {
    id: string;
    name: string;
    durationMinutes: number;
    priceCents: number;
  }[];
};
