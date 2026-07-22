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
import { cn } from "@/lib/utils";

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

  const showSearch = items.length > 5 || query.trim().length > 0;

  return (
    <CatalogListShell>
      <CatalogListToolbar
        tone="dark"
        search={
          showSearch ? (
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Buscar serviço…"
              inputClassName={ADMIN_SURFACE.input}
            />
          ) : (
            <p className={cn("text-sm", ADMIN_SURFACE.muted)}>
              {counts.active} ativo{counts.active === 1 ? "" : "s"}
              {counts.inactive > 0
                ? ` · ${counts.inactive} inativo${counts.inactive === 1 ? "" : "s"}`
                : ""}
            </p>
          )
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
          <Button
            asChild
            className={cn(
              "h-10 w-full sm:h-9 sm:w-auto",
              ADMIN_SURFACE.btnPrimary
            )}
          >
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

          <div className={cn(ADMIN_SURFACE.panel, "overflow-hidden md:hidden")}>
            <ul className="divide-y divide-white/10">
              {filtered.map((service) => (
                <li key={service.id}>
                  <ServiceMobileCard
                    service={service}
                    tone="dark"
                    embedded
                  />
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </CatalogListShell>
  );
}
