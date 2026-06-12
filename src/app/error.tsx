"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function GlobalError({
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
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <h1 className="text-xl font-semibold">Não foi possível carregar a página</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Algo falhou no servidor. Tente recarregar. Se continuar, confira se as
        variáveis do Supabase estão cadastradas na Vercel e faça um novo deploy.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button type="button" onClick={reset}>
          Tentar de novo
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/">Ir para o início</Link>
        </Button>
      </div>
    </div>
  );
}
