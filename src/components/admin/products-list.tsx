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
  CatalogMobileList,
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

  return (
    <CatalogListShell>
      <CatalogListToolbar
        tone="dark"
        search={
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Buscar produto..."
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
          <>
            <Button asChild variant="outline" className={ADMIN_SURFACE.btnGhost}>
              <Link href="/admin/produtos/categorias">
                <Tags />
                Categorias
              </Link>
            </Button>
            <Button asChild className={ADMIN_SURFACE.btnPrimary}>
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
            <CatalogTableBody>
              {filtered.map((product) => (
                <ProductListRow
                  key={product.id}
                  product={product}
                  tone="dark"
                />
              ))}
            </CatalogTableBody>
          </CatalogTable>

          <CatalogMobileList>
            {filtered.map((product) => (
              <ProductMobileCard
                key={product.id}
                product={product}
                tone="dark"
              />
            ))}
          </CatalogMobileList>
        </>
      )}
    </CatalogListShell>
  );
}
