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
  CustomerListRow,
  CustomerMobileCard,
  type CustomerListItem,
} from "@/components/admin/customer-list-row";
import { matchesSearch } from "@/lib/text";

export function CustomersList({ items }: { items: CustomerListItem[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CatalogFilter>("all");

  const counts = useMemo(
    () => ({
      all: items.length,
      active: items.filter((item) => item.appointmentCount > 0).length,
      inactive: items.filter((item) => item.appointmentCount === 0).length,
    }),
    [items]
  );

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (filter === "active" && item.appointmentCount === 0) return false;
      if (filter === "inactive" && item.appointmentCount > 0) return false;
      if (
        query &&
        !matchesSearch(
          `${item.firstName} ${item.lastName} ${item.whatsapp}`,
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
            placeholder="Buscar cliente..."
          />
        }
        filters={
          <CatalogFilterSegment
            value={filter}
            onChange={setFilter}
            counts={counts}
            labels={{
              all: "Todos",
              active: "Com visitas",
              inactive: "Sem visitas",
            }}
          />
        }
        actions={
          <Button asChild>
            <Link href="/admin/clientes/novo">
              <Plus />
              Novo cliente
            </Link>
          </Button>
        }
      />

      {filtered.length === 0 ? (
        <CatalogListEmpty
          title="Nenhum cliente encontrado"
          description="Ajuste a busca ou o filtro, ou cadastre um novo cliente."
        />
      ) : (
        <>
          <CatalogTable>
            <CatalogTableHead>
              <CatalogTableHeadCell>Cliente</CatalogTableHeadCell>
              <CatalogTableHeadCell className="hidden md:table-cell">
                WhatsApp
              </CatalogTableHeadCell>
              <CatalogTableHeadCell className="hidden lg:table-cell">
                Visitas
              </CatalogTableHeadCell>
              <CatalogTableHeadCell className="w-12" />
            </CatalogTableHead>
            <CatalogTableBody>
              {filtered.map((customer) => (
                <CustomerListRow key={customer.id} customer={customer} />
              ))}
            </CatalogTableBody>
          </CatalogTable>

          <CatalogMobileList>
            {filtered.map((customer) => (
              <CustomerMobileCard key={customer.id} customer={customer} />
            ))}
          </CatalogMobileList>
        </>
      )}
    </CatalogListShell>
  );
}
