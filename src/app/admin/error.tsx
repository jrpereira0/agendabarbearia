"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AdminError({
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
      <h1 className="text-xl font-semibold">Erro no painel</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Não foi possível abrir esta parte do painel. Tente de novo ou volte ao
        login.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button type="button" onClick={reset}>
          Tentar de novo
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/">Ir para o login</Link>
        </Button>
      </div>
    </div>
  );
}
