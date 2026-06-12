"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AgendaError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <h1 className="text-xl font-semibold">Agenda indisponível</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Não foi possível carregar a página de agendamento. Tente de novo em
        instantes.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button type="button" onClick={reset}>
          Tentar de novo
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/">Voltar ao início</Link>
        </Button>
      </div>
    </div>
  );
}
