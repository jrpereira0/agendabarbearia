export const WEEKDAYS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
] as const;

// "2026-12-24" -> "qui, 24/12/2026"
export function formatDateBR(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// "09:00:00" ou "09:00" -> "09:00"
export function formatTime(time: string): string {
  return time.slice(0, 5);
}

// Formata centavos como moeda: 3500 -> "R$ 35,00"
export function formatPriceBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

// Formata duração em minutos: 90 -> "1h30", 45 -> "45 min"
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

// Lista de serviços pra exibir na agenda: "Corte, Barba" ou "Corte +2"
export function formatServiceNames(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length <= 2) return names.join(", ");
  return `${names[0]} +${names.length - 1}`;
}

// Formata "11999998888" como "(11) 99999-8888" para exibição.
export function formatWhatsapp(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
