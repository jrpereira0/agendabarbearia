"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function PanelError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h2 className="text-lg font-semibold">Não foi possível abrir esta tela</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Algo falhou ao carregar o painel. Tente de novo. Se o problema
        continuar, saia e entre novamente.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button type="button" onClick={reset}>
          Tentar de novo
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/admin">Voltar à agenda</Link>
        </Button>
      </div>
    </div>
  );
}
