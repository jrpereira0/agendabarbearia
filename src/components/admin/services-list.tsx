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
  ServiceListRow,
  ServiceMobileCard,
} from "@/components/admin/service-list-row";
import { matchesSearch } from "@/lib/text";
import type { ServiceWeekdayPrice } from "@/lib/service-weekday-prices";
import { ADMIN_SURFACE } from "@/lib/admin-surface";

type Service = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  priceFrom: boolean;
  weekdayPrices: ServiceWeekdayPrice[];
  durationMinutes: number;
  photoUrl: string | null;
  photoPosition?: string | null;
  active: boolean;
  professionalNames: string[];
};

export function ServicesList({ items }: { items: Service[] }) {
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
          `${item.name} ${item.description} ${item.professionalNames.join(" ")}`,
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
        tone="dark"
        search={
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Buscar serviço..."
            inputClassName={ADMIN_SURFACE.input}
          />
        }
        filters={
          <CatalogFilterSegment
            tone="dark"
            value={filter}
            onChange={setFilter}
            counts={counts}
          />
        }
        actions={
          <Button asChild className={ADMIN_SURFACE.btnPrimary}>
            <Link href="/admin/servicos/novo">
              <Plus />
              Novo serviço
            </Link>
          </Button>
        }
      />

      {filtered.length === 0 ? (
        <CatalogListEmpty
          tone="dark"
          title="Nenhum serviço encontrado"
          description="Ajuste a busca ou o filtro, ou cadastre um novo serviço."
        />
      ) : (
        <>
          <CatalogTable tone="dark">
            <CatalogTableHead tone="dark">
              <CatalogTableHeadCell>Serviço</CatalogTableHeadCell>
              <CatalogTableHeadCell className="hidden w-[9.5rem] md:table-cell">
                Equipe
              </CatalogTableHeadCell>
              <CatalogTableHeadCell className="w-[11rem] text-right sm:w-[13rem]">
                Preço
              </CatalogTableHeadCell>
              <CatalogTableHeadCell className="w-12" />
            </CatalogTableHead>
            <CatalogTableBody tone="dark">
              {filtered.map((service) => (
                <ServiceListRow
                  key={service.id}
                  service={service}
                  tone="dark"
                />
              ))}
            </CatalogTableBody>
          </CatalogTable>

          <CatalogMobileList>
            {filtered.map((service) => (
              <ServiceMobileCard
                key={service.id}
                service={service}
                tone="dark"
              />
            ))}
          </CatalogMobileList>
        </>
      )}
    </CatalogListShell>
  );
}
