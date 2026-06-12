import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BOOKING_PATH } from "@/lib/booking-path";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-6">
          <span className="text-lg font-semibold tracking-tight">
            Agenda Barbearia
          </span>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin">Área do barbeiro</Link>
          </Button>
        </div>
      </header>

      <main className="flex flex-1 items-center">
        <div className="mx-auto w-full max-w-5xl px-6 py-24">
          <div className="max-w-2xl">
            <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Agende seu horário sem complicação.
            </h1>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              Escolha o profissional, os serviços e o melhor horário para você.
              A confirmação chega direto no seu WhatsApp.
            </p>
            <div className="mt-10">
              <Button asChild size="lg" className="h-12 px-8 text-base">
                <Link href={BOOKING_PATH}>Agendar horário</Link>
              </Button>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center px-6">
          <p className="text-sm text-muted-foreground">
            Agenda Barbearia — agendamento online
          </p>
        </div>
      </footer>
    </div>
  );
}
