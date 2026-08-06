import { formatDateBR } from "@/lib/format";

/** Soma (ou subtrai) dias a uma data ISO (AAAA-MM-DD), em UTC. */
export function shiftDate(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Primeiro dia do mês da data ISO informada. */
export function monthStart(isoDate: string): string {
  return `${isoDate.slice(0, 7)}-01`;
}

/** Quantidade de dias entre duas datas ISO (AAAA-MM-DD), incluindo as duas pontas. */
export function inclusiveDayCount(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00Z`).getTime();
  const end = new Date(`${to}T00:00:00Z`).getTime();
  return Math.max(1, Math.round((end - start) / 86_400_000) + 1);
}

/** "12/06/2026" ou "12/06/2026 a 15/06/2026" conforme o período. */
export function formatPeriodLabel(from: string, to: string): string {
  if (from === to) return formatDateBR(from);
  return `${formatDateBR(from)} a ${formatDateBR(to)}`;
}
