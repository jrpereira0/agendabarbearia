"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/admin/search-input";
import { ProfessionalCard } from "@/components/admin/professional-card";
import { matchesSearch } from "@/lib/text";

type Professional = {
  id: string;
  firstName: string;
  lastName: string;
  nickname: string;
  whatsapp: string;
  instagram: string | null;
  photoUrl: string | null;
  active: boolean;
  serviceNames: string[];
};

export function ProfessionalsList({ items }: { items: Professional[] }) {
  const [query, setQuery] = useState("");

  const filtered = query
    ? items.filter((p) =>
        matchesSearch(
          `${p.nickname} ${p.firstName} ${p.lastName} ${p.whatsapp} ${p.instagram ?? ""}`,
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
          placeholder="Buscar profissional por nome, apelido ou WhatsApp..."
        />
        <Button asChild className="h-10 shrink-0">
          <Link href="/admin/profissionais/novo">
            <Plus />
            Novo profissional
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
            Nenhum profissional encontrado. Tente buscar por outro termo.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <ProfessionalCard key={p.id} professional={p} />
          ))}
        </div>
      )}
    </div>
  );
}
