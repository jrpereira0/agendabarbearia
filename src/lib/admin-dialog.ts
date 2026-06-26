import { cn } from "@/lib/utils";

/** Modal largo do painel (comanda, editar agendamento, etc.). */
export function adminWideDialogClassName(): string {
  return cn(
    "flex flex-col gap-0 overflow-hidden p-0",
    "max-h-[100dvh] w-[calc(100vw-0.5rem)] max-w-[calc(100vw-0.5rem)]",
    "sm:max-h-[min(94dvh,860px)] sm:w-[calc(100vw-1.5rem)] sm:max-w-[min(96vw,80rem)]"
  );
}
