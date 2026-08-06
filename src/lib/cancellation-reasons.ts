/**
 * Motivos rápidos do dialog de cancelamento no admin.
 * “Erro” e “Remarcou” não entram na métrica de cancelamentos reais.
 */
export const QUICK_CANCELLATION_REASONS = [
  "Cliente desmarcou",
  "Não compareceu",
  "Remarcou horário",
  "Erro no agendamento",
] as const;

/** Motivo usado quando o próprio cliente cancela pelo site/app. */
export const CLIENT_SELF_CANCEL_REASON = "Cliente desmarcou";

/**
 * Cancelamentos operacionais / de correção — não contam como
 * “cliente desistiu” nas métricas.
 */
export const NOISE_CANCELLATION_REASONS = new Set<string>([
  "Erro no agendamento",
  "Remarcou horário",
  "Cancelado pelo status na agenda",
]);

/** Cancelamento real: tem data, tem motivo e não é ruído operacional. */
export function isRealCancellation(row: {
  cancellation_reason: string | null;
  cancelled_at: string | null;
}): boolean {
  if (!row.cancelled_at) return false;
  const reason = row.cancellation_reason?.trim();
  if (!reason) return false;
  return !NOISE_CANCELLATION_REASONS.has(reason);
}
