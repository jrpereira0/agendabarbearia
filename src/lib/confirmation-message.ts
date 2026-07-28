import { formatDateBR, formatTime } from "@/lib/format";
import { normalizeWhatsapp } from "@/lib/whatsapp";

/** Tags que o dono pode usar no modelo da mensagem de confirmação. */
export const CONFIRMATION_MESSAGE_TAGS = [
  {
    tag: "{{primeiro_nome}}",
    label: "Primeiro nome",
    description: "Só o primeiro nome do cliente",
  },
  {
    tag: "{{nome}}",
    label: "Nome completo",
    description: "Nome e sobrenome do cliente",
  },
  {
    tag: "{{barbeiro}}",
    label: "Barbeiro",
    description: "Apelido do profissional",
  },
  {
    tag: "{{data}}",
    label: "Data",
    description: "Dia do atendimento (ex.: 28/07/2026)",
  },
  {
    tag: "{{hora}}",
    label: "Horário",
    description: "Hora de início",
  },
  {
    tag: "{{servicos}}",
    label: "Serviços",
    description: "Nomes dos serviços do atendimento",
  },
  {
    tag: "{{loja}}",
    label: "Nome da loja",
    description: "Nome da barbearia nas configurações",
  },
] as const;

export type ConfirmationMessageTag =
  (typeof CONFIRMATION_MESSAGE_TAGS)[number]["tag"];

export const DEFAULT_CONFIRMATION_WHATSAPP_MESSAGE =
  "Olá {{primeiro_nome}}! Confirmando seu horário na {{loja}}.\n\nData: {{data}} às {{hora}}\nServiço: {{servicos}}\nBarbeiro: {{barbeiro}}\n\nTe esperamos!";

export type ConfirmationMessageContext = {
  customerFirstName: string;
  customerLastName: string;
  professionalNickname: string;
  date: string;
  startTime: string;
  serviceNames: string[];
  shopName: string;
};

function fullCustomerName(ctx: ConfirmationMessageContext): string {
  return [ctx.customerFirstName, ctx.customerLastName]
    .filter((part) => part.trim())
    .join(" ");
}

function formatServiceNames(names: string[]): string {
  const counts = new Map<string, number>();
  for (const name of names) {
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, qty]) => (qty > 1 ? `${name} ×${qty}` : name))
    .join(", ");
}

/** Troca as tags do modelo pelos dados do atendimento. */
export function applyConfirmationTags(
  template: string,
  ctx: ConfirmationMessageContext
): string {
  const values: Record<string, string> = {
    "{{primeiro_nome}}": ctx.customerFirstName.trim() || "cliente",
    "{{nome}}": fullCustomerName(ctx) || "cliente",
    "{{barbeiro}}": ctx.professionalNickname.trim() || "barbeiro",
    "{{data}}": formatDateBR(ctx.date),
    "{{hora}}": formatTime(ctx.startTime),
    "{{servicos}}": formatServiceNames(ctx.serviceNames) || "serviço",
    "{{loja}}": ctx.shopName.trim() || "barbearia",
  };

  return template.replace(
    /\{\{(primeiro_nome|nome|barbeiro|data|hora|servicos|loja)\}\}/g,
    (match) => values[match] ?? match
  );
}

/**
 * Monta o link wa.me com o número normalizado e, se houver, a mensagem pronta.
 * Evita prefixar 55 duas vezes quando o número já vem com DDI.
 */
export function buildWhatsappChatUrl(
  rawWhatsapp: string,
  message?: string
): string | null {
  const digits = normalizeWhatsapp(rawWhatsapp);
  if (!digits) return null;

  const base = `https://wa.me/${digits}`;
  const text = message?.trim();
  if (!text) return base;
  return `${base}?text=${encodeURIComponent(text)}`;
}

export function buildConfirmationWhatsappUrl(
  rawWhatsapp: string,
  template: string,
  ctx: ConfirmationMessageContext
): string | null {
  return buildWhatsappChatUrl(
    rawWhatsapp,
    applyConfirmationTags(template, ctx)
  );
}
