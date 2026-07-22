import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BOOKING_PATH } from "@/lib/booking-path";
import "@/styles/booking-theme.css";

export function BookingUnavailable() {
  return (
    <div className="booking-theme flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="booking-display text-xl font-medium">Agenda indisponível</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Não foi possível carregar os horários agora. Tente de novo em instantes
        ou fale com a barbearia pelo WhatsApp.
      </p>
      <Button asChild>
        <Link href={BOOKING_PATH}>Tentar de novo</Link>
      </Button>
    </div>
  );
}
