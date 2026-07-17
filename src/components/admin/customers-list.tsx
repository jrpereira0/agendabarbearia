"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { formatWhatsapp } from "@/lib/format";
import { matchesCustomerSearch } from "@/lib/text";
import { cn } from "@/lib/utils";

const SUGGESTION_LIMIT = 8;

export function CustomersList({ items }: { items: CustomerListItem[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CatalogFilter>("all");
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      if (query && !matchesCustomerSearch(item, query)) return false;
      return true;
    });
  }, [items, filter, query]);

  const suggestions = useMemo(() => {
    const q = query.trim();
    if (q.length < 2) return [];
    return filtered.slice(0, SUGGESTION_LIMIT);
  }, [filtered, query]);

  function handleQueryChange(value: string) {
    setQuery(value);
    setSuggestionsOpen(value.trim().length >= 2);
  }

  function handleSearchFocus() {
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
    if (query.trim().length >= 2) setSuggestionsOpen(true);
  }

  function handleSearchBlur() {
    blurTimerRef.current = setTimeout(() => {
      setSuggestionsOpen(false);
    }, 150);
  }

  function openCustomer(id: string) {
    setSuggestionsOpen(false);
    router.push(`/admin/clientes/${id}`);
  }

  return (
    <CatalogListShell>
      <CatalogListToolbar
        search={
          <div className="relative w-full">
            <SearchInput
              value={query}
              onChange={handleQueryChange}
              onFocus={handleSearchFocus}
              onBlur={handleSearchBlur}
              placeholder="Nome ou últimos dígitos do WhatsApp..."
            />
            {suggestionsOpen && suggestions.length > 0 && (
              <ul
                className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-20 overflow-hidden rounded-xl border bg-card shadow-md"
                onMouseDown={(e) => e.preventDefault()}
              >
                {suggestions.map((customer) => {
                  const fullName = `${customer.firstName} ${customer.lastName}`;
                  return (
                    <li key={customer.id}>
                      <button
                        type="button"
                        onClick={() => openCustomer(customer.id)}
                        className={cn(
                          "flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors",
                          "hover:bg-muted/60"
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {fullName}
                          </p>
                          <p className="truncate text-xs tabular-nums text-muted-foreground">
                            {formatWhatsapp(customer.whatsapp)}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
                {filtered.length > SUGGESTION_LIMIT && (
                  <li className="border-t px-3.5 py-2 text-xs text-muted-foreground">
                    +{filtered.length - SUGGESTION_LIMIT} na lista abaixo
                  </li>
                )}
              </ul>
            )}
          </div>
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
          description={
            query.trim()
              ? "Tente pelo nome ou pelos últimos dígitos do WhatsApp."
              : "Ajuste a busca ou o filtro, ou cadastre um novo cliente."
          }
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
