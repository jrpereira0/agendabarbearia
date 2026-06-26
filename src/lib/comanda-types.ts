export const PAYMENT_METHODS = ["pix", "cash", "debit", "credit"] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  pix: "Pix",
  cash: "Dinheiro",
  debit: "Cartão débito",
  credit: "Cartão crédito",
};

export type ComandaStatus = "open" | "closed";

export type ComandaItem = {
  id: string;
  serviceId: string | null;
  serviceName: string;
  catalogPriceCents: number;
  chargedPriceCents: number;
  sortOrder: number;
  squeezeAppointmentId: string | null;
  appointmentId: string | null;
  professionalId: string | null;
  professionalNickname: string;
};

export type ComandaPayment = {
  id: string;
  paymentMethod: PaymentMethod;
  amountCents: number;
};

export type ComandaLinkedAppointment = {
  id: string;
  professionalId: string;
  professionalNickname: string;
  startTime: string;
  endTime: string;
  status: string;
  isSqueezeIn: boolean;
};

export type ComandaDetail = {
  id: string;
  appointmentId: string;
  professionalId: string;
  professionalNickname: string;
  status: ComandaStatus;
  commissionPercentSnapshot: number | null;
  totalCents: number;
  commissionCents: number;
  closedAt: string | null;
  items: ComandaItem[];
  payments: ComandaPayment[];
  linkedAppointments: ComandaLinkedAppointment[];
  customerFirstName: string;
  customerLastName: string;
  customerWhatsapp: string;
  serviceDate: string;
  /** @deprecated use linkedAppointments */
  appointment: {
    date: string;
    startTime: string;
    endTime: string;
    status: string;
    customerFirstName: string;
    customerLastName: string;
    customerWhatsapp: string;
    isSqueezeIn: boolean;
  };
};

export type ComandaItemInput = {
  id?: string;
  serviceId: string;
  serviceName: string;
  catalogPriceCents: number;
  chargedPriceCents: number;
  appointmentId?: string;
  professionalId?: string;
};

export type ComandaPaymentInput = {
  paymentMethod: PaymentMethod;
  amountCents: number;
};

export function calculateComandaTotals(
  items: Pick<ComandaItem, "chargedPriceCents">[],
  commissionPercent: number
): { totalCents: number; commissionCents: number } {
  let totalCents = 0;
  let commissionCents = 0;
  for (const item of items) {
    totalCents += item.chargedPriceCents;
    commissionCents += Math.round(
      (item.chargedPriceCents * commissionPercent) / 100
    );
  }
  return { totalCents, commissionCents };
}

export function calculateComandaTotalsByProfessional(
  items: {
    chargedPriceCents: number;
    professionalId: string | null;
  }[],
  commissionByProfessional: Map<string, number>
): { totalCents: number; commissionCents: number } {
  let totalCents = 0;
  let commissionCents = 0;
  for (const item of items) {
    totalCents += item.chargedPriceCents;
    const pct = item.professionalId
      ? (commissionByProfessional.get(item.professionalId) ?? 50)
      : 50;
    commissionCents += Math.round((item.chargedPriceCents * pct) / 100);
  }
  return { totalCents, commissionCents };
}

export function sumPayments(payments: Pick<ComandaPayment, "amountCents">[]): number {
  return payments.reduce((sum, p) => sum + p.amountCents, 0);
}
