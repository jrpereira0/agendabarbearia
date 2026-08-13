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
import { capitalizePersonName, canRunCustomerSearch, normalizeText } from "@/lib/text";
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
    firstName.trim() && whatsapp.replace(/\D/g, "").length >= 10
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

/** Destaca no texto os pedaços que batem com a busca (ignora acento). */
function HighlightMatch({
  text,
  query,
  className,
}: {
  text: string;
  query: string;
  className?: string;
}) {
  const tokens = normalizeText(query)
    .split(/\s+/)
    .map((t) => t.replace(/\d/g, ""))
    .filter((t) => t.length >= 2);

  if (tokens.length === 0 || !text) {
    return <span className={className}>{text}</span>;
  }

  const lower = normalizeText(text);
  let firstIdx = -1;
  let firstLen = 0;
  for (const token of tokens) {
    const idx = lower.indexOf(token);
    if (idx >= 0 && (firstIdx < 0 || idx < firstIdx)) {
      firstIdx = idx;
      firstLen = token.length;
    }
  }

  if (firstIdx < 0) {
    return <span className={className}>{text}</span>;
  }

  const before = text.slice(0, firstIdx);
  const match = text.slice(firstIdx, firstIdx + firstLen);
  const after = text.slice(firstIdx + firstLen);

  return (
    <span className={className}>
      {before}
      <mark className="rounded-sm bg-[var(--booking-accent,#ecf15e)]/25 px-0.5 text-inherit">
        {match}
      </mark>
      {after}
    </span>
  );
}

function HighlightPhone({
  whatsapp,
  query,
}: {
  whatsapp: string;
  query: string;
}) {
  const formatted = formatWhatsapp(whatsapp);
  const digits = query.replace(/\D/g, "");
  if (digits.length < 3) {
    return (
      <span className="truncate text-xs tabular-nums text-muted-foreground">
        {formatted}
      </span>
    );
  }

  const phoneDigits = whatsapp.replace(/\D/g, "");
  const digitIdx = phoneDigits.indexOf(digits);
  if (digitIdx < 0) {
    return (
      <span className="truncate text-xs tabular-nums text-muted-foreground">
        {formatted}
      </span>
    );
  }

  // Mapeia índice nos dígitos → posição no texto formatado.
  let digitCount = 0;
  let start = -1;
  let end = -1;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i]!)) {
      if (digitCount === digitIdx) start = i;
      if (digitCount === digitIdx + digits.length - 1) {
        end = i + 1;
        break;
      }
      digitCount += 1;
    }
  }

  if (start < 0 || end < 0) {
    return (
      <span className="truncate text-xs tabular-nums text-muted-foreground">
        {formatted}
      </span>
    );
  }

  return (
    <span className="truncate text-xs tabular-nums text-muted-foreground">
      {formatted.slice(0, start)}
      <mark className="rounded-sm bg-[var(--booking-accent,#ecf15e)]/25 px-0.5 text-inherit">
        {formatted.slice(start, end)}
      </mark>
      {formatted.slice(end)}
    </span>
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
  const [activeIndex, setActiveIndex] = useState(-1);
  const [customerFound, setCustomerFound] = useState<boolean | null>(() =>
    hasCustomerData(firstName, lastName, whatsapp) ? true : null
  );
  const lastLookupDigitsRef = useRef("");
  const lastSearchRef = useRef("");
  const mountedRef = useRef(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [wasEnabled, setWasEnabled] = useState(enabled);

  const trimmedQuery = searchQuery.trim();
  const showSearchResults = mode === "search" && canRunCustomerSearch(trimmedQuery);

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
    } else if (!canRunCustomerSearch(searchQuery)) {
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
      setActiveIndex(-1);
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
    setActiveIndex(-1);
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
        onFirstNameChange(capitalizePersonName(parts[0] ?? ""));
        if (parts.length > 1) {
          onLastNameChange(capitalizePersonName(parts.slice(1).join(" ")));
        }
      }
    }
    setSearchQuery("");
    setSuggestions([]);
    setActiveIndex(-1);
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
    setActiveIndex(-1);
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

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showSearchResults || suggestions.length === 0) {
      if (e.key === "Escape") {
        setSearchQuery("");
        setSuggestions([]);
        setActiveIndex(-1);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : 0
      );
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) =>
        prev <= 0 ? suggestions.length - 1 : prev - 1
      );
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const pick =
        activeIndex >= 0 ? suggestions[activeIndex] : suggestions[0];
      if (pick) selectCustomer(pick);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setSearchQuery("");
      setSuggestions([]);
      setActiveIndex(-1);
    }
  }

  const searchQueryTooShort =
    enabled && trimmedQuery.length > 0 && !canRunCustomerSearch(trimmedQuery);
  if (searchQueryTooShort || (enabled && trimmedQuery.length === 0)) {
    if (suggestions.length > 0) setSuggestions([]);
    if (searchLoading) setSearchLoading(false);
    if (activeIndex !== -1) setActiveIndex(-1);
  }

  useEffect(() => {
    if (!enabled || mode !== "search") return;

    const q = searchQuery.trim();
    if (!canRunCustomerSearch(q)) return;

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
            setActiveIndex(-1);
            return;
          }
          setSuggestions(result.customers);
          setActiveIndex(result.customers.length > 0 ? 0 : -1);
        })
        .catch(() => {
          if (!cancelled && mountedRef.current) {
            toast.error("Não foi possível buscar clientes.");
          }
        })
        .finally(() => {
          if (!cancelled && mountedRef.current) setSearchLoading(false);
        });
    }, 180);

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
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setActiveIndex(-1);
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder="Nome, sobrenome ou WhatsApp…"
              autoComplete="off"
              aria-autocomplete="list"
              aria-controls={
                showSearchResults ? `${idPrefix}-search-list` : undefined
              }
              aria-activedescendant={
                activeIndex >= 0
                  ? `${idPrefix}-search-option-${activeIndex}`
                  : undefined
              }
              className="h-11 pl-10 pr-10 [&::-webkit-search-cancel-button]:hidden"
            />
            {searchLoading && (
              <Loader2 className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>

          {!showSearchResults && (
            <div className="booking-notice rounded-xl px-4 py-5 text-center">
              <UserRoundSearch className="mx-auto size-5 opacity-80" />
              <p className="mt-2 text-sm">
                Digite 2 letras do nome (sem acento) ou 3 dígitos do
                WhatsApp.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Ex.: Jo, Silva ou 998
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
                <>
                  <div className="flex items-center justify-between gap-2 border-b px-3.5 py-2 text-xs text-muted-foreground">
                    <span>
                      {suggestions.length}{" "}
                      {suggestions.length === 1
                        ? "cliente encontrado"
                        : "clientes encontrados"}
                    </span>
                    <span className="hidden sm:inline">↑↓ Enter</span>
                  </div>
                  <ul
                    id={`${idPrefix}-search-list`}
                    role="listbox"
                    className="max-h-56 divide-y overflow-y-auto"
                  >
                    {suggestions.map((customer, index) => {
                      const selected = index === activeIndex;
                      return (
                        <li
                          key={customer.id}
                          role="option"
                          aria-selected={selected}
                        >
                          <button
                            type="button"
                            id={`${idPrefix}-search-option-${index}`}
                            onClick={() => selectCustomer(customer)}
                            onMouseEnter={() => setActiveIndex(index)}
                            className={cn(
                              "booking-pick flex w-full items-center gap-3 px-3.5 py-3 text-left",
                              selected && "booking-pick-active"
                            )}
                          >
                            <CustomerAvatar
                              firstName={customer.firstName}
                              lastName={customer.lastName}
                              className="size-9 text-[11px]"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">
                                <HighlightMatch
                                  text={`${customer.firstName} ${customer.lastName}`.trim()}
                                  query={trimmedQuery}
                                />
                              </p>
                              <HighlightPhone
                                whatsapp={customer.whatsapp}
                                query={trimmedQuery}
                              />
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : (
                <div className="booking-notice rounded-none border-0 px-4 py-4 text-center">
                  <p className="text-sm">
                    Nenhum cliente com{" "}
                    <span className="font-medium">
                      &ldquo;{trimmedQuery}&rdquo;
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Tente outras letras, 3 dígitos do zap ou cadastre novo.
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
              WhatsApp novo — preencha o nome para cadastrar. Sobrenome é
              opcional.
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
                onBlur={() =>
                  onFirstNameChange(capitalizePersonName(firstName))
                }
                autoComplete="given-name"
                placeholder="João"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}LastName`}>
                Sobrenome (opcional)
              </Label>
              <Input
                id={`${idPrefix}LastName`}
                value={lastName}
                onChange={(e) => {
                  onLastNameChange(e.target.value);
                  if (customerFound === true) setCustomerFound(null);
                }}
                onBlur={() =>
                  onLastNameChange(capitalizePersonName(lastName))
                }
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
