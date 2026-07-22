"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Tags } from "lucide-react";
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
  ProductListRow,
  ProductMobileCard,
} from "@/components/admin/product-list-row";
import { matchesSearch } from "@/lib/text";
import { ADMIN_SURFACE } from "@/lib/admin-surface";
import { cn } from "@/lib/utils";

type Product = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  commissionPercent: number;
  stockQuantity: number;
  photoUrl: string | null;
  photoPosition?: string | null;
  active: boolean;
  categoryName: string;
};

export function ProductsList({ items }: { items: Product[] }) {
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
          `${item.name} ${item.description} ${item.categoryName}`,
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
              placeholder="Buscar produto…"
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
          <>
            <Button
              asChild
              variant="outline"
              className={cn(
                "h-10 w-full sm:h-9 sm:w-auto",
                ADMIN_SURFACE.btnGhost
              )}
            >
              <Link href="/admin/produtos/categorias">
                <Tags />
                Categorias
              </Link>
            </Button>
            <Button
              asChild
              className={cn(
                "h-10 w-full sm:h-9 sm:w-auto",
                ADMIN_SURFACE.btnPrimary
              )}
            >
              <Link href="/admin/produtos/novo">
                <Plus />
                Novo produto
              </Link>
            </Button>
          </>
        }
      />

      {filtered.length === 0 ? (
        <CatalogListEmpty
          tone="dark"
          title="Nenhum produto encontrado"
          description="Ajuste a busca ou o filtro, ou cadastre um novo produto."
        />
      ) : (
        <>
          <CatalogTable tone="dark">
            <CatalogTableHead tone="dark">
              <CatalogTableHeadCell>Produto</CatalogTableHeadCell>
              <CatalogTableHeadCell className="text-right">
                Preço
              </CatalogTableHeadCell>
              <CatalogTableHeadCell className="hidden text-right sm:table-cell">
                Comissão
              </CatalogTableHeadCell>
              <CatalogTableHeadCell className="text-right">
                Estoque
              </CatalogTableHeadCell>
              <CatalogTableHeadCell className="w-12" />
            </CatalogTableHead>
            <CatalogTableBody tone="dark">
              {filtered.map((product) => (
                <ProductListRow
                  key={product.id}
                  product={product}
                  tone="dark"
                />
              ))}
            </CatalogTableBody>
          </CatalogTable>

          <div className={cn(ADMIN_SURFACE.panel, "overflow-hidden md:hidden")}>
            <ul className="divide-y divide-white/10">
              {filtered.map((product) => (
                <li key={product.id}>
                  <ProductMobileCard
                    product={product}
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
