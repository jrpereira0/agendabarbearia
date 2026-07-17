"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  Loader2,
  Phone,
  User,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchInput } from "@/components/admin/search-input";
import {
  lookupCustomerForAdmin,
  searchCustomersForAdmin,
  type AdminCustomerMatch,
} from "@/app/admin/(panel)/agenda/lookup-customer-action";
import { formatWhatsapp } from "@/lib/format";
import {
  normalizeWhatsapp,
  whatsappLookupDelayMs,
} from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

type AdminCustomerFieldsProps = {
  firstName: string;
  lastName: string;
  whatsapp: string;
  onFirstNameChange: (value: string) => void;
  onLastNameChange: (value: string) => void;
  onWhatsappChange: (value: string) => void;
  enabled?: boolean;
  idPrefix?: string;
};

function customerInitials(firstName: string, lastName: string): string {
  return [firstName, lastName]
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function CustomerAvatar({
  firstName,
  lastName,
  className,
}: {
  firstName: string;
  lastName: string;
  className?: string;
}) {
  const initials = customerInitials(firstName, lastName);

  return (
    <div
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full border border-foreground/15 bg-foreground text-xs font-semibold text-background",
        className
      )}
    >
      {initials || <User className="size-4" />}
    </div>
  );
}

export function AdminCustomerFields({
  firstName,
  lastName,
  whatsapp,
  onFirstNameChange,
  onLastNameChange,
  onWhatsappChange,
  enabled = true,
  idPrefix = "customer",
}: AdminCustomerFieldsProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<AdminCustomerMatch[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [customerFound, setCustomerFound] = useState<boolean | null>(null);
  const lastLookupDigitsRef = useRef("");
  const lastSearchRef = useRef("");
  const mountedRef = useRef(false);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      setSearchQuery("");
      setSuggestions([]);
      setSuggestionsOpen(false);
      setCustomerFound(null);
      setLookupLoading(false);
      setSearchLoading(false);
      lastLookupDigitsRef.current = "";
      lastSearchRef.current = "";
    }
  }, [enabled]);

  function resetSelection() {
    lastLookupDigitsRef.current = "";
    setCustomerFound(null);
  }

  function clearAll() {
    onWhatsappChange("");
    onFirstNameChange("");
    onLastNameChange("");
    setSearchQuery("");
    setSuggestions([]);
    setSuggestionsOpen(false);
    resetSelection();
  }

  function selectCustomer(customer: AdminCustomerMatch) {
    onWhatsappChange(formatWhatsapp(customer.whatsapp));
    onFirstNameChange(customer.firstName);
    onLastNameChange(customer.lastName);
    lastLookupDigitsRef.current = normalizeWhatsapp(customer.whatsapp) ?? "";
    lastSearchRef.current = "";
    setSearchQuery("");
    setSuggestions([]);
    setSuggestionsOpen(false);
    setCustomerFound(true);
  }

  function prefillFromSearchQuery(q: string) {
    if (firstName || lastName || whatsapp) return;

    const trimmed = q.trim();
    const digits = trimmed.replace(/\D/g, "");
    const hasLetters = /[a-zA-ZÀ-ÿ]/.test(trimmed);

    if (!hasLetters && digits.length >= 8) {
      onWhatsappChange(formatWhatsapp(digits));
      return;
    }

    if (hasLetters) {
      const parts = trimmed.split(/\s+/).filter(Boolean);
      onFirstNameChange(parts[0] ?? "");
      if (parts.length > 1) {
        onLastNameChange(parts.slice(1).join(" "));
      }
    }
  }

  function handleWhatsappChange(raw: string) {
    const formatted = formatWhatsapp(raw);
    onWhatsappChange(formatted);
    const key = normalizeWhatsapp(formatted);
    if (key !== lastLookupDigitsRef.current) {
      setCustomerFound(null);
    }
    if (!key) {
      lastLookupDigitsRef.current = "";
    }
  }

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const q = searchQuery.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setSuggestionsOpen(false);
      setSearchLoading(false);
      lastSearchRef.current = "";
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      if (q === lastSearchRef.current) return;
      lastSearchRef.current = q;
      setSearchLoading(true);

      void searchCustomersForAdmin(q)
        .then((result) => {
          if (cancelled || !mountedRef.current) return;
          if (!result.ok) {
            toast.error(result.error);
            setSuggestions([]);
            setSuggestionsOpen(false);
            return;
          }
          setSuggestions(result.customers);
          setSuggestionsOpen(true);
          if (result.customers.length === 0) {
            prefillFromSearchQuery(q);
          }
        })
        .catch(() => {
          if (!cancelled && mountedRef.current) {
            toast.error("Não foi possível buscar clientes.");
          }
        })
        .finally(() => {
          if (!cancelled && mountedRef.current) setSearchLoading(false);
        });
    }, 280);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    searchQuery,
    enabled,
    firstName,
    lastName,
    whatsapp,
    onFirstNameChange,
    onLastNameChange,
    onWhatsappChange,
  ]);

  useEffect(() => {
    if (!enabled) return;
    if (customerFound === true) return;

    const delay = whatsappLookupDelayMs(whatsapp);
    if (delay === null) {
      lastLookupDigitsRef.current = "";
      return;
    }

    let cancelled = false;

    const timer = setTimeout(() => {
      const current = normalizeWhatsapp(whatsapp);
      if (cancelled || !current) return;
      if (current === lastLookupDigitsRef.current) return;

      lastLookupDigitsRef.current = current;
      if (!mountedRef.current) return;
      setLookupLoading(true);

      void lookupCustomerForAdmin(current)
        .then((result) => {
          if (cancelled || !mountedRef.current) return;

          if (!result.ok) {
            lastLookupDigitsRef.current = "";
            toast.error(result.error);
            return;
          }

          if (result.found) {
            onFirstNameChange(result.firstName);
            onLastNameChange(result.lastName);
            setCustomerFound(true);
          } else {
            setCustomerFound(false);
          }
        })
        .catch(() => {
          if (!cancelled && mountedRef.current) {
            lastLookupDigitsRef.current = "";
            toast.error("Não foi possível buscar o cliente. Tente de novo.");
          }
        })
        .finally(() => {
          if (!cancelled && mountedRef.current) setLookupLoading(false);
        });
    }, delay);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [whatsapp, enabled, customerFound, onFirstNameChange, onLastNameChange]);

  function handleSearchBlur() {
    blurTimerRef.current = setTimeout(() => {
      setSuggestionsOpen(false);
    }, 150);
  }

  function handleSearchFocus() {
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
    if (searchQuery.trim().length >= 2) {
      setSuggestionsOpen(true);
    }
  }

  function handleSearchChange(value: string) {
    setSearchQuery(value);
    if (value.trim().length >= 2) {
      setSuggestionsOpen(true);
    } else {
      setSuggestionsOpen(false);
    }
  }

  const trimmedQuery = searchQuery.trim();
  const showDropdown =
    suggestionsOpen && trimmedQuery.length >= 2 && customerFound !== true;

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="border-b bg-muted/25 px-4 py-3">
        <p className="text-sm font-medium">Cliente</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Busque um cadastro existente ou preencha os dados abaixo.
        </p>
      </div>

      <div className="space-y-4 px-4 py-4">
        <div className="relative">
          <SearchInput
            value={searchQuery}
            onChange={handleSearchChange}
            onFocus={handleSearchFocus}
            onBlur={handleSearchBlur}
            placeholder="Buscar por nome ou 4 últimos dígitos..."
          />

          {showDropdown && (
            <div
              className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-30 overflow-hidden rounded-xl border bg-card shadow-lg"
              onMouseDown={(e) => e.preventDefault()}
            >
              {searchLoading && suggestions.length === 0 ? (
                <div className="flex items-center gap-2 px-4 py-3.5 text-sm text-muted-foreground">
                  <Loader2 className="size-4 shrink-0 animate-spin" />
                  Buscando clientes...
                </div>
              ) : suggestions.length > 0 ? (
                <>
                  <ul className="max-h-52 overflow-y-auto">
                    {suggestions.map((customer) => (
                      <li key={customer.id}>
                        <button
                          type="button"
                          onClick={() => selectCustomer(customer)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                        >
                          <CustomerAvatar
                            firstName={customer.firstName}
                            lastName={customer.lastName}
                            className="size-9 text-[11px]"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {customer.firstName} {customer.lastName}
                            </p>
                            <p className="truncate text-xs tabular-nums text-muted-foreground">
                              {formatWhatsapp(customer.whatsapp)}
                            </p>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center gap-2 border-t bg-muted/15 px-4 py-2.5 text-sm text-muted-foreground">
                      <UserPlus className="size-4 shrink-0" />
                    Se não for nenhum desses, preencha os dados abaixo.
                  </div>
                </>
              ) : (
                <div className="px-4 py-4">
                  <p className="text-sm text-muted-foreground">
                    Nenhum cliente com{" "}
                    <span className="font-medium text-foreground">
                      &ldquo;{trimmedQuery}&rdquo;
                    </span>
                    .
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Continue preenchendo o cadastro abaixo.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {customerFound === true && (
          <div className="flex items-start gap-3 rounded-xl border bg-muted/25 px-3 py-3">
            <CustomerAvatar
              firstName={firstName}
              lastName={lastName}
              className="size-9 text-[11px]"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <Check className="size-3.5 text-muted-foreground" />
                <p className="text-sm font-medium">Cliente encontrado</p>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {firstName} {lastName} · {formatWhatsapp(whatsapp)}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 shrink-0 px-2"
              onClick={clearAll}
            >
              Limpar
            </Button>
          </div>
        )}

        <div className="space-y-3 border-t pt-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Dados para o agendamento
            </p>
            {lookupLoading && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                Verificando
              </span>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}Whatsapp`}>WhatsApp</Label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id={`${idPrefix}Whatsapp`}
                inputMode="numeric"
                placeholder="(11) 99999-9999"
                value={whatsapp}
                onChange={(e) => handleWhatsappChange(e.target.value)}
                autoComplete="tel"
                className="pl-9"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}FirstName`}>Nome</Label>
              <Input
                id={`${idPrefix}FirstName`}
                value={firstName}
                onChange={(e) => {
                  onFirstNameChange(e.target.value);
                  if (customerFound === true) setCustomerFound(null);
                }}
                autoComplete="given-name"
                placeholder="João"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}LastName`}>Sobrenome</Label>
              <Input
                id={`${idPrefix}LastName`}
                value={lastName}
                onChange={(e) => {
                  onLastNameChange(e.target.value);
                  if (customerFound === true) setCustomerFound(null);
                }}
                autoComplete="family-name"
                placeholder="Silva"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
