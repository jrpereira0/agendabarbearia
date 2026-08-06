import { cn } from "@/lib/utils";

/** Modal da comanda: largo o bastante pra itens + pagamento, com folga da borda da tela. */
export function adminComandaDialogClassName(): string {
  return cn(
    "admin-booking-dialog flex flex-col gap-0 overflow-hidden rounded-2xl p-0 ring-0",
    "max-h-[min(92dvh,820px)] w-[calc(100vw-1.25rem)] max-w-[calc(100vw-1.25rem)]",
    "sm:w-[calc(100vw-2rem)] sm:max-w-[min(96vw,72rem)]"
  );
}
