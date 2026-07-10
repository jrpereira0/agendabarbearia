"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/admin/search-input";
import {
  CatalogFilterSegment,
  CatalogListEmpty,
  CatalogListShell,
  CatalogListToolbar,
  CatalogMobileList,
  CatalogTable,
  CatalogTableBody,
  CatalogTableHead,
  CatalogTableHeadCell,
  type CatalogFilter,
} from "@/components/admin/catalog-list";
import {
  ProfessionalListRow,
  ProfessionalMobileCard,
} from "@/components/admin/professional-list-row";
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
  const [filter, setFilter] = useState<CatalogFilter>("all");

  const counts = useMemo(
    () => ({
      all: items.length,
      active: items.filter((item) => item.active).length,
      inactive: items.filter((item) => !item.active).length,
    }),
    [items]
  );

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (filter === "active" && !item.active) return false;
      if (filter === "inactive" && item.active) return false;
      if (
        query &&
        !matchesSearch(
          `${item.nickname} ${item.firstName} ${item.lastName} ${item.whatsapp} ${item.instagram ?? ""}`,
          query
        )
      ) {
        return false;
      }
      return true;
    });
  }, [items, filter, query]);

  return (
    <CatalogListShell>
      <CatalogListToolbar
        search={
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Buscar profissional..."
          />
        }
        filters={
          <CatalogFilterSegment value={filter} onChange={setFilter} counts={counts} />
        }
        actions={
          <Button asChild>
            <Link href="/admin/profissionais/novo">
              <Plus />
              Novo profissional
            </Link>
          </Button>
        }
      />

      {filtered.length === 0 ? (
        <CatalogListEmpty
          title="Nenhum profissional encontrado"
          description="Ajuste a busca ou o filtro, ou cadastre um novo profissional."
        />
      ) : (
        <>
          <CatalogTable>
            <CatalogTableHead>
              <CatalogTableHeadCell>Profissional</CatalogTableHeadCell>
              <CatalogTableHeadCell className="hidden md:table-cell">
                WhatsApp
              </CatalogTableHeadCell>
              <CatalogTableHeadCell className="hidden lg:table-cell">
                Serviços
              </CatalogTableHeadCell>
              <CatalogTableHeadCell className="w-12" />
            </CatalogTableHead>
            <CatalogTableBody>
              {filtered.map((professional) => (
                <ProfessionalListRow key={professional.id} professional={professional} />
              ))}
            </CatalogTableBody>
          </CatalogTable>

          <CatalogMobileList>
            {filtered.map((professional) => (
              <ProfessionalMobileCard key={professional.id} professional={professional} />
            ))}
          </CatalogMobileList>
        </>
      )}
    </CatalogListShell>
  );
}
