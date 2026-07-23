"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ClientWhatsappAuth,
  logoutClientSession,
} from "@/components/booking/client-whatsapp-auth";
import { formatWhatsapp } from "@/lib/format";

type Phase = "auth" | "profile";

export function MyAccount() {
  const [phase, setPhase] = useState<Phase>("auth");
  const [whatsapp, setWhatsapp] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);

  const loadProfile = useCallback(async (wa: string) => {
    setLoading(true);
    setWhatsapp(wa);
    try {
      const res = await fetch("/api/v1/customers/me", {
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error ?? "Não foi possível carregar seus dados.");
        setFirstName("");
        setLastName("");
        setHasProfile(false);
        setPhase("profile");
        return;
      }
      if (body.found && body.customer) {
        setFirstName(body.customer.firstName ?? "");
        setLastName(body.customer.lastName ?? "");
        setHasProfile(true);
      } else {
        setFirstName("");
        setLastName("");
        setHasProfile(false);
      }
      setPhase("profile");
    } catch {
      toast.error("Não foi possível carregar seus dados.");
      setPhase("profile");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAuthenticated = useCallback(
    (wa: string) => {
      void loadProfile(wa);
    },
    [loadProfile]
  );

  async function handleSave() {
    const nome = firstName.trim();
    const sobrenome = lastName.trim();
    if (!nome || !sobrenome) {
      toast.error("Preencha nome e sobrenome.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/v1/customers/me", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: nome, lastName: sobrenome }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error ?? "Não foi possível salvar.");
        return;
      }
      setFirstName(body.customer?.firstName ?? nome);
      setLastName(body.customer?.lastName ?? sobrenome);
      setHasProfile(true);
      toast.success("Dados salvos.");
    } catch {
      toast.error("Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await logoutClientSession();
    setPhase("auth");
    setWhatsapp("");
    setFirstName("");
    setLastName("");
    setHasProfile(false);
  }

  if (phase === "auth") {
    return (
      <div className="flex min-h-0 flex-1 flex-col px-5 pt-6">
        <h2 className="booking-display text-[1.75rem] font-medium leading-tight tracking-tight">
          Minha conta
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Confirme o WhatsApp com o código pra ver e editar seus dados.
        </p>

        <div className="mt-8">
          <ClientWhatsappAuth
            onAuthenticated={handleAuthenticated}
            hint="Enviamos um código no WhatsApp. Depois disso você acessa seu cadastro neste aparelho."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col px-5 pt-5 pb-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="booking-display text-[1.75rem] font-medium leading-tight tracking-tight">
            Minha conta
          </h2>
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Phone className="size-3.5 shrink-0" strokeWidth={1.75} />
            <span className="tabular-nums">{formatWhatsapp(whatsapp)}</span>
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 text-muted-foreground"
          onClick={() => void handleLogout()}
        >
          Sair
        </Button>
      </div>

      {loading ? (
        <p className="mt-10 text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <div className="mt-6 rounded-2xl bg-[#151618] px-4 py-4 ring-1 ring-white/8">
          <p className="text-sm font-medium text-[#f5f5f5]">
            {hasProfile ? "Seus dados" : "Complete seu cadastro"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {hasProfile
              ? "Você pode alterar nome e sobrenome. O WhatsApp fica vinculado à sua conta."
              : "Ainda não há cadastro neste número. Informe nome e sobrenome pra salvar."}
          </p>

          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="account-first-name">Nome</Label>
              <Input
                id="account-first-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
                className="h-11 rounded-xl border-white/10 bg-[#0e0f11]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="account-last-name">Sobrenome</Label>
              <Input
                id="account-last-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
                className="h-11 rounded-xl border-white/10 bg-[#0e0f11]"
              />
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3">
              <p className="text-xs text-muted-foreground">WhatsApp</p>
              <p className="mt-1 text-[0.95rem] font-semibold tabular-nums text-[#f5f5f5]">
                {formatWhatsapp(whatsapp)}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Não pode ser alterado por aqui.
              </p>
            </div>
          </div>

          <Button
            type="button"
            className="mt-5 h-11 w-full rounded-2xl font-semibold"
            disabled={saving}
            onClick={() => void handleSave()}
          >
            {saving ? "Salvando…" : "Salvar alterações"}
          </Button>
        </div>
      )}
    </div>
  );
}
