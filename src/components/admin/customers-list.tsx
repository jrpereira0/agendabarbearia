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
import { ADMIN_SURFACE } from "@/lib/admin-surface";
import { cn } from "@/lib/utils";

const SUGGESTION_LIMIT = 8;

export function CustomersList({
  items,
  canDeleteCustomers = true,
}: {
  items: CustomerListItem[];
  canDeleteCustomers?: boolean;
}) {
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
        tone="dark"
        search={
          <div className="relative w-full">
            <SearchInput
              value={query}
              onChange={handleQueryChange}
              onFocus={handleSearchFocus}
              onBlur={handleSearchBlur}
              placeholder="Nome ou últimos dígitos do WhatsApp…"
              inputClassName={ADMIN_SURFACE.input}
            />
            {suggestionsOpen && suggestions.length > 0 && (
              <ul
                className={cn(
                  "absolute left-0 right-0 top-[calc(100%+0.35rem)] z-20 overflow-hidden rounded-xl border shadow-md",
                  "border-white/10 bg-[#151618]"
                )}
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
                          "hover:bg-white/[0.04]"
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-[#f5f5f5]">
                            {fullName}
                          </p>
                          <p
                            className={cn(
                              "truncate text-xs tabular-nums",
                              ADMIN_SURFACE.muted
                            )}
                          >
                            {formatWhatsapp(customer.whatsapp)}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
                {filtered.length > SUGGESTION_LIMIT && (
                  <li
                    className={cn(
                      "border-t border-white/10 px-3.5 py-2 text-xs",
                      ADMIN_SURFACE.muted
                    )}
                  >
                    +{filtered.length - SUGGESTION_LIMIT} na lista abaixo
                  </li>
                )}
              </ul>
            )}
          </div>
        }
        filters={
          <CatalogFilterSegment
            tone="dark"
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
          <Button
            asChild
            className={cn(
              "h-10 w-full sm:h-9 sm:w-auto",
              ADMIN_SURFACE.btnPrimary
            )}
          >
            <Link href="/admin/clientes/novo">
              <Plus />
              Novo cliente
            </Link>
          </Button>
        }
      />

      {filtered.length === 0 ? (
        <CatalogListEmpty
          tone="dark"
          title="Nenhum cliente encontrado"
          description={
            query.trim()
              ? "Tente pelo nome ou pelos últimos dígitos do WhatsApp."
              : "Ajuste a busca ou o filtro, ou cadastre um novo cliente."
          }
        />
      ) : (
        <>
          <CatalogTable tone="dark">
            <CatalogTableHead tone="dark">
              <CatalogTableHeadCell>Cliente</CatalogTableHeadCell>
              <CatalogTableHeadCell className="hidden md:table-cell">
                WhatsApp
              </CatalogTableHeadCell>
              <CatalogTableHeadCell className="hidden lg:table-cell">
                Visitas
              </CatalogTableHeadCell>
              <CatalogTableHeadCell className="w-12" />
            </CatalogTableHead>
            <CatalogTableBody tone="dark">
              {filtered.map((customer) => (
                <CustomerListRow
                  key={customer.id}
                  customer={customer}
                  tone="dark"
                  canDeleteCustomers={canDeleteCustomers}
                />
              ))}
            </CatalogTableBody>
          </CatalogTable>

          <div className={cn(ADMIN_SURFACE.panel, "overflow-hidden md:hidden")}>
            <ul className="divide-y divide-white/10">
              {filtered.map((customer) => (
                <li key={customer.id}>
                  <CustomerMobileCard
                    customer={customer}
                    tone="dark"
                    embedded
                    canDeleteCustomers={canDeleteCustomers}
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
