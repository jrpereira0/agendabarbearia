"use client";

import { useEffect } from "react";

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
    <html lang="pt-BR">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-6 text-center font-sans text-black">
        <h1 className="text-xl font-semibold">Algo deu errado</h1>
        <p className="max-w-md text-sm text-neutral-600">
          Não foi possível carregar o site. Tente recarregar a página.
        </p>
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white"
        >
          Tentar de novo
        </button>
      </body>
    </html>
  );
}
