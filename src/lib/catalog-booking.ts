/** Índice 0–6 = domingo … sábado (legenda na API de serviços). */
export const BOOKING_DAY_LABELS = [
  "Dom",
  "Seg",
  "Ter",
  "Qua",
  "Qui",
  "Sex",
  "Sab",
] as const;

/** @deprecated Mantido para testes de compatibilidade com nomes legados sem weekdayPrices. */
export function serviceMatchesDateBand(
  serviceName: string,
  weekday: number
): boolean {
  const REGEX_SEG_QUA = /Seg\.\s*-\s*Qua\.|Seg\s*-\s*Qua|Seg\.\s*-\s*Quar\./i;
  const REGEX_QUI_SAB = /Qui\.\s*-\s*Sáb\.|Qui\s*-\s*Sab|Qui\.\s*-\s*Sab\./i;
  const hasSegQua = REGEX_SEG_QUA.test(serviceName);
  const hasQuiSab = REGEX_QUI_SAB.test(serviceName);

  if (!hasSegQua && !hasQuiSab) {
    return weekday !== 0;
  }

  if (weekday >= 1 && weekday <= 3) return hasSegQua;
  if (weekday >= 4 && weekday <= 6) return hasQuiSab;
  return false;
}
