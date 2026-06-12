"use client";

import { useState } from "react";
import { SearchX } from "lucide-react";
import { SearchInput } from "@/components/admin/search-input";
import { CustomerCard } from "@/components/admin/customer-card";
import { matchesSearch } from "@/lib/text";

type Customer = {
  id: string;
  firstName: string;
  lastName: string;
  whatsapp: string;
  appointmentCount: number;
};

export function CustomersList({ items }: { items: Customer[] }) {
  const [query, setQuery] = useState("");

  const filtered = query
    ? items.filter((c) =>
        matchesSearch(
          `${c.firstName} ${c.lastName} ${c.whatsapp}`,
          query
        )
      )
    : items;

  return (
    <div className="flex flex-col gap-4">
      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Buscar cliente por nome ou WhatsApp..."
      />

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
            Nenhum cliente encontrado. Tente buscar por outro termo.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => (
            <CustomerCard key={c.id} customer={c} />
          ))}
        </div>
      )}
    </div>
  );
}
