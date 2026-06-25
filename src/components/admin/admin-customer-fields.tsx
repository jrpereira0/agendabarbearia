"use client";

import { useEffect, useRef, useState } from "react";
import { User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatWhatsapp } from "@/lib/format";
import {
  normalizeWhatsapp,
  whatsappLookupDelayMs,
} from "@/lib/whatsapp";

type CustomerLookupResponse =
  | { found: true; firstName: string; lastName: string }
  | { found: false };

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
  const [lookupLoading, setLookupLoading] = useState(false);
  const [customerFound, setCustomerFound] = useState<boolean | null>(null);
  const lastLookupDigitsRef = useRef("");

  function resetLookup() {
    lastLookupDigitsRef.current = "";
    setCustomerFound(null);
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

  function handleUseOtherNumber() {
    onWhatsappChange("");
    onFirstNameChange("");
    onLastNameChange("");
    resetLookup();
  }

  useEffect(() => {
    if (!enabled) {
      resetLookup();
      setCustomerFound(null);
      setLookupLoading(false);
      return;
    }

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
      setLookupLoading(true);

      fetch(`/api/v1/customers/lookup?whatsapp=${encodeURIComponent(current)}`)
        .then(async (res) => {
          const body = (await res.json()) as CustomerLookupResponse & {
            error?: string;
          };
          if (cancelled) return;

          if (!res.ok) {
            lastLookupDigitsRef.current = "";
            toast.error(body.error ?? "Não foi possível buscar o cliente.");
            return;
          }

          if (body.found) {
            onFirstNameChange(body.firstName);
            onLastNameChange(body.lastName);
            setCustomerFound(true);
          } else {
            onFirstNameChange("");
            onLastNameChange("");
            setCustomerFound(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            lastLookupDigitsRef.current = "";
            toast.error("Não foi possível buscar o cliente. Tente de novo.");
          }
        })
        .finally(() => {
          if (!cancelled) setLookupLoading(false);
        });
    }, delay);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    whatsapp,
    enabled,
    onFirstNameChange,
    onLastNameChange,
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}Whatsapp`}>WhatsApp</Label>
        <Input
          id={`${idPrefix}Whatsapp`}
          inputMode="numeric"
          placeholder="(11) 99999-9999"
          value={whatsapp}
          onChange={(e) => handleWhatsappChange(e.target.value)}
          autoComplete="tel"
        />
        <p className="text-xs text-muted-foreground">
          {lookupLoading
            ? "Buscando cadastro..."
            : "Digite o número completo para identificar o cliente."}
        </p>
      </div>

      {customerFound === true && (
        <div className="rounded-lg border bg-muted/30 px-4 py-4">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full border bg-background">
              <User className="size-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Cliente já cadastrado</p>
              <p className="mt-0.5 text-sm">
                {firstName} {lastName}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                O nome vem do cadastro e não pode ser alterado aqui. Para
                corrigir, use a área Clientes.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-3 h-8 px-2"
            onClick={handleUseOtherNumber}
          >
            Usar outro número
          </Button>
        </div>
      )}

      {customerFound === false && (
        <>
          <p className="text-sm text-muted-foreground">
            Cliente novo — informe o nome para cadastrar junto com o agendamento.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${idPrefix}FirstName`}>Nome</Label>
              <Input
                id={`${idPrefix}FirstName`}
                value={firstName}
                onChange={(e) => onFirstNameChange(e.target.value)}
                autoComplete="given-name"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${idPrefix}LastName`}>Sobrenome</Label>
              <Input
                id={`${idPrefix}LastName`}
                value={lastName}
                onChange={(e) => onLastNameChange(e.target.value)}
                autoComplete="family-name"
              />
            </div>
          </div>
        </>
      )}

    </div>
  );
}
