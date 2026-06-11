"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/admin/search-input";
import { ServiceCard } from "@/components/admin/service-card";
import { matchesSearch } from "@/lib/text";

type Service = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  durationMinutes: number;
  photoUrl: string | null;
  active: boolean;
  professionalNames: string[];
};

export function ServicesList({ items }: { items: Service[] }) {
  const [query, setQuery] = useState("");

  const filtered = query
    ? items.filter((s) =>
        matchesSearch(
          `${s.name} ${s.description} ${s.professionalNames.join(" ")}`,
          query
        )
      )
    : items;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Buscar serviço por nome ou descrição..."
        />
        <Button asChild className="h-10 shrink-0">
          <Link href="/admin/servicos/novo">
            <Plus />
            Novo serviço
          </Link>
        </Button>
      </div>

      {query && (
        <p className="text-sm text-muted-foreground">
          {filtered.length === 0
            ? "Nenhum resultado"
            : `${filtered.length} resultado${filtered.length === 1 ? "" : "s"}`}{" "}
          pra <span className="font-medium text-foreground">&quot;{query}&quot;</span>
        </p>
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-12 text-center">
          <SearchX className="size-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nenhum serviço encontrado. Tente buscar por outro termo.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((s) => (
            <ServiceCard key={s.id} service={s} />
          ))}
        </div>
      )}
    </div>
  );
}
