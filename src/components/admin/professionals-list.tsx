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
  ProfessionalListRow,
  ProfessionalMobileCard,
} from "@/components/admin/professional-list-row";
import { matchesSearch } from "@/lib/text";
import { ADMIN_SURFACE } from "@/lib/admin-surface";
import { cn } from "@/lib/utils";

type Professional = {
  id: string;
  firstName: string;
  lastName: string;
  nickname: string;
  whatsapp: string;
  instagram: string | null;
  photoUrl: string | null;
  photoPosition?: string | null;
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
      inactive: items.filter((item) => item.active === false).length,
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
              placeholder="Buscar profissional…"
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
            className={cn("h-10 w-full sm:h-9 sm:w-auto", ADMIN_SURFACE.btnPrimary)}
          >
            <Link href="/admin/profissionais/novo">
              <Plus />
              Novo profissional
            </Link>
          </Button>
        }
      />

      {filtered.length === 0 ? (
        <CatalogListEmpty
          tone="dark"
          title="Nenhum profissional encontrado"
          description="Ajuste a busca ou o filtro, ou cadastre um novo profissional."
        />
      ) : (
        <>
          <CatalogTable tone="dark">
            <CatalogTableHead tone="dark">
              <CatalogTableHeadCell>Profissional</CatalogTableHeadCell>
              <CatalogTableHeadCell className="hidden md:table-cell">
                WhatsApp
              </CatalogTableHeadCell>
              <CatalogTableHeadCell className="hidden lg:table-cell">
                Serviços
              </CatalogTableHeadCell>
              <CatalogTableHeadCell className="w-12" />
            </CatalogTableHead>
            <CatalogTableBody tone="dark">
              {filtered.map((professional) => (
                <ProfessionalListRow
                  key={professional.id}
                  professional={professional}
                  tone="dark"
                />
              ))}
            </CatalogTableBody>
          </CatalogTable>

          <div
            className={cn(
              ADMIN_SURFACE.panel,
              "overflow-hidden md:hidden"
            )}
          >
            <ul className="divide-y divide-white/10">
              {filtered.map((professional) => (
                <li key={professional.id}>
                  <ProfessionalMobileCard
                    professional={professional}
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
