"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  Loader2,
  Phone,
  Search,
  User,
  UserPlus,
  UserRoundSearch,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  /** Texto curto acima da busca (ex.: trocar cliente). */
  hint?: string;
};

type Mode = "search" | "selected" | "form";

function customerInitials(firstName: string, lastName: string): string {
  return [firstName, lastName]
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function hasCustomerData(
  firstName: string,
  lastName: string,
  whatsapp: string
): boolean {
  return Boolean(
    firstName.trim() && lastName.trim() && whatsapp.replace(/\D/g, "").length >= 10
  );
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
  hint,
}: AdminCustomerFieldsProps) {
  const [mode, setMode] = useState<Mode>(() =>
    hasCustomerData(firstName, lastName, whatsapp) ? "selected" : "search"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<AdminCustomerMatch[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [customerFound, setCustomerFound] = useState<boolean | null>(() =>
    hasCustomerData(firstName, lastName, whatsapp) ? true : null
  );
  const lastLookupDigitsRef = useRef("");
  const lastSearchRef = useRef("");
  const mountedRef = useRef(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [wasEnabled, setWasEnabled] = useState(enabled);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      lastLookupDigitsRef.current = "";
      lastSearchRef.current = "";
    } else if (searchQuery.trim().length < 2) {
      lastSearchRef.current = "";
    }
  }, [enabled, searchQuery]);

  if (enabled !== wasEnabled) {
    setWasEnabled(enabled);
    if (!enabled) {
      setSearchQuery("");
      setSuggestions([]);
      setCustomerFound(null);
      setLookupLoading(false);
      setSearchLoading(false);
      setMode("search");
    } else if (hasCustomerData(firstName, lastName, whatsapp)) {
      setMode("selected");
      setCustomerFound(true);
    } else {
      setMode("search");
    }
  }

  function clearFields() {
    onWhatsappChange("");
    onFirstNameChange("");
    onLastNameChange("");
    lastLookupDigitsRef.current = "";
    setCustomerFound(null);
  }

  function goToSearch(options?: { clear?: boolean; focus?: boolean }) {
    if (options?.clear) clearFields();
    setSearchQuery("");
    setSuggestions([]);
    setSearchLoading(false);
    lastSearchRef.current = "";
    setMode("search");
    if (options?.focus !== false) {
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }

  function goToForm(prefillQuery?: string) {
    const q = (prefillQuery ?? searchQuery).trim();
    if (!firstName && !lastName && !whatsapp && q) {
      const digits = q.replace(/\D/g, "");
      const hasLetters = /[a-zA-ZÀ-ÿ]/.test(q);
      if (!hasLetters && digits.length >= 8) {
        onWhatsappChange(formatWhatsapp(digits));
      } else if (hasLetters) {
        const parts = q.split(/\s+/).filter(Boolean);
        onFirstNameChange(parts[0] ?? "");
        if (parts.length > 1) onLastNameChange(parts.slice(1).join(" "));
      }
    }
    setSearchQuery("");
    setSuggestions([]);
    setMode("form");
  }

  function selectCustomer(customer: AdminCustomerMatch) {
    onWhatsappChange(formatWhatsapp(customer.whatsapp));
    onFirstNameChange(customer.firstName);
    onLastNameChange(customer.lastName);
    lastLookupDigitsRef.current = normalizeWhatsapp(customer.whatsapp) ?? "";
    lastSearchRef.current = "";
    setSearchQuery("");
    setSuggestions([]);
    setCustomerFound(true);
    setMode("selected");
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

  const searchQueryTooShort = enabled && searchQuery.trim().length < 2;
  if (searchQueryTooShort) {
    if (suggestions.length > 0) setSuggestions([]);
    if (searchLoading) setSearchLoading(false);
  }

  useEffect(() => {
    if (!enabled || mode !== "search") return;

    const q = searchQuery.trim();
    if (q.length < 2) return;

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
            return;
          }
          setSuggestions(result.customers);
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
  }, [searchQuery, enabled, mode]);

  useEffect(() => {
    if (!enabled || mode !== "form") return;
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
            setMode("selected");
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
  }, [
    whatsapp,
    enabled,
    mode,
    customerFound,
    onFirstNameChange,
    onLastNameChange,
  ]);

  const trimmedQuery = searchQuery.trim();
  const showSearchResults = mode === "search" && trimmedQuery.length >= 2;

  return (
    <div className="space-y-4">
      {hint ? (
        <p className="text-sm text-muted-foreground">{hint}</p>
      ) : null}

      {mode === "selected" && (
        <div className="booking-context space-y-3 rounded-xl border px-3.5 py-3.5">
          <div className="flex items-start gap-3">
            <CustomerAvatar firstName={firstName} lastName={lastName} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <Check className="size-3.5 shrink-0 text-[var(--booking-accent,#16a34a)]" />
                <p className="text-xs font-medium text-muted-foreground">
                  Cliente selecionado
                </p>
              </div>
              <p className="mt-0.5 truncate text-base font-medium">
                {firstName} {lastName}
              </p>
              <p className="text-sm tabular-nums text-muted-foreground">
                {formatWhatsapp(whatsapp)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="booking-btn-ghost h-8"
              onClick={() => goToSearch({ clear: true })}
            >
              <UserRoundSearch className="size-3.5" />
              Buscar outro
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="booking-btn-ghost h-8"
              onClick={() => setMode("form")}
            >
              Editar dados
            </Button>
          </div>
        </div>
      )}

      {mode === "search" && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Nome ou WhatsApp do cliente..."
              autoComplete="off"
              className="h-11 pl-10 pr-3 [&::-webkit-search-cancel-button]:hidden"
            />
          </div>

          {!showSearchResults && (
            <div className="booking-notice rounded-xl px-4 py-5 text-center">
              <UserRoundSearch className="mx-auto size-5 opacity-80" />
              <p className="mt-2 text-sm">
                Digite pelo menos 2 letras ou os últimos dígitos do WhatsApp.
              </p>
            </div>
          )}

          {showSearchResults && (
            <div className="overflow-hidden rounded-xl border">
              {searchLoading && suggestions.length === 0 ? (
                <div className="flex items-center gap-2 px-4 py-4 text-sm text-muted-foreground">
                  <Loader2 className="size-4 shrink-0 animate-spin" />
                  Buscando...
                </div>
              ) : suggestions.length > 0 ? (
                <ul className="max-h-52 divide-y overflow-y-auto">
                  {suggestions.map((customer) => (
                    <li key={customer.id}>
                      <button
                        type="button"
                        onClick={() => selectCustomer(customer)}
                        className="booking-pick flex w-full items-center gap-3 px-3.5 py-3 text-left"
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
              ) : (
                <div className="booking-notice rounded-none border-0 px-4 py-4 text-center">
                  <p className="text-sm">
                    Nenhum cliente com{" "}
                    <span className="font-medium">
                      &ldquo;{trimmedQuery}&rdquo;
                    </span>
                  </p>
                </div>
              )}
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            className="booking-btn-ghost h-10 w-full justify-start gap-2"
            onClick={() => goToForm()}
          >
            <UserPlus className="size-4" />
            Cadastrar cliente novo
          </Button>
        </div>
      )}

      {mode === "form" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="booking-btn-ghost -ml-2 h-8 gap-1.5 px-2"
              onClick={() => goToSearch({ clear: false, focus: true })}
            >
              <ArrowLeft className="size-3.5" />
              Voltar à busca
            </Button>
            {lookupLoading && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                Verificando WhatsApp
              </span>
            )}
          </div>

          {customerFound === false && (
            <div className="booking-notice rounded-xl px-3 py-2.5 text-xs">
              WhatsApp novo — preencha nome e sobrenome para cadastrar.
            </div>
          )}

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
                className="h-11 pl-9"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
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
                className="h-11"
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
                className="h-11"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
