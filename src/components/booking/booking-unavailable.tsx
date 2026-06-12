import Link from "next/link";
import { Button } from "@/components/ui/button";

export function BookingUnavailable() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <h1 className="text-xl font-semibold">Agenda indisponível</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Não foi possível carregar os horários agora. Tente de novo em instantes
        ou fale com a barbearia pelo WhatsApp.
      </p>
      <Button asChild variant="outline">
        <Link href="/">Voltar ao início</Link>
      </Button>
    </div>
  );
}
