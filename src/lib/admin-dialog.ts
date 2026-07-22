import { cn } from "@/lib/utils";

/** Modal largo do painel (comanda, editar agendamento, etc.). */
export function adminWideDialogClassName(): string {
  return cn(
    "flex flex-col gap-0 overflow-hidden p-0",
    "max-h-[100dvh] w-[calc(100vw-0.5rem)] max-w-[calc(100vw-0.5rem)]",
    "sm:max-h-[min(94dvh,860px)] sm:w-[calc(100vw-1.5rem)] sm:max-w-[min(96vw,80rem)]"
  );
}

/** Modal da comanda: largo o bastante pra itens + pagamento, com folga da borda da tela. */
export function adminComandaDialogClassName(): string {
  return cn(
    "admin-booking-dialog flex flex-col gap-0 overflow-hidden rounded-2xl p-0 ring-0",
    "max-h-[min(92dvh,820px)] w-[calc(100vw-1.25rem)] max-w-[calc(100vw-1.25rem)]",
    "sm:w-[calc(100vw-2rem)] sm:max-w-[min(96vw,72rem)]"
  );
}
