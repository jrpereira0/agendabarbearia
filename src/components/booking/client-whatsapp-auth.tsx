"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatWhatsapp } from "@/lib/format";
import { OTP_CODE_LENGTH } from "@/lib/client-whatsapp-otp-constants";
import { normalizeWhatsapp, whatsappLookupDelayMs } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

type AuthPhase = "phone" | "code";

type ClientWhatsappAuthProps = {
  /** Título curto acima do campo. */
  title?: string;
  /** Texto de ajuda. */
  hint?: string;
  /** Chamado quando o WhatsApp foi confirmado por OTP (ou sessão já válida). */
  onAuthenticated: (whatsapp: string) => void;
  /** Se true, ao montar tenta reaproveitar a sessão existente. */
  resumeSession?: boolean;
  className?: string;
};

export function ClientWhatsappAuth({
  title = "WhatsApp",
  hint = "Enviamos um código no WhatsApp pra confirmar que o número é seu.",
  onAuthenticated,
  resumeSession = true,
  className,
}: ClientWhatsappAuthProps) {
  const [phase, setPhase] = useState<AuthPhase>("phone");
  const [whatsapp, setWhatsapp] = useState("");
  const [code, setCode] = useState("");
  const [checkingSession, setCheckingSession] = useState(resumeSession);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [expiresInMinutes, setExpiresInMinutes] = useState(5);

  useEffect(() => {
    if (!resumeSession) {
      const timer = setTimeout(() => setCheckingSession(false), 0);
      return () => clearTimeout(timer);
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      fetch("/api/agenda/session", { credentials: "include" })
        .then(async (res) => {
          const body = await res.json().catch(() => ({}));
          if (cancelled) return;
          if (body.authenticated && typeof body.whatsapp === "string") {
            onAuthenticated(body.whatsapp);
            return;
          }
          setCheckingSession(false);
        })
        .catch(() => {
          if (!cancelled) setCheckingSession(false);
        });
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [onAuthenticated, resumeSession]);

  async function sendCode() {
    const canonical = normalizeWhatsapp(whatsapp);
    if (!canonical || whatsappLookupDelayMs(whatsapp) === null) {
      toast.error("Informe um WhatsApp válido.");
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/agenda/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsapp: canonical }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error ?? "Não foi possível enviar o código.");
        return;
      }
      setExpiresInMinutes(body.expiresInMinutes ?? 5);
      setPhase("code");
      setCode("");
      toast.success("Código enviado no WhatsApp.");
    } catch {
      toast.error("Não foi possível enviar o código.");
    } finally {
      setSending(false);
    }
  }

  async function verifyCode() {
    const canonical = normalizeWhatsapp(whatsapp);
    if (!canonical) {
      toast.error("Informe um WhatsApp válido.");
      return;
    }

    setVerifying(true);
    try {
      const res = await fetch("/api/agenda/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ whatsapp: canonical, code }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error ?? "Código inválido.");
        return;
      }
      onAuthenticated(
        typeof body.whatsapp === "string" ? body.whatsapp : canonical
      );
    } catch {
      toast.error("Não foi possível validar o código.");
    } finally {
      setVerifying(false);
    }
  }

  if (checkingSession) {
    return (
      <div
        className={cn(
          "rounded-2xl bg-[#151618] px-4 py-5 ring-1 ring-white/8",
          className
        )}
      >
        <p className="text-sm text-muted-foreground">Verificando seu acesso...</p>
      </div>
    );
  }

  if (phase === "phone") {
    return (
      <div
        className={cn(
          "rounded-2xl bg-[#151618] px-4 py-4 ring-1 ring-white/8",
          className
        )}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="clientWhatsappAuth" className="text-xs">
            {title}
          </Label>
          <Input
            id="clientWhatsappAuth"
            inputMode="numeric"
            placeholder="(11) 99999-9999"
            value={whatsapp}
            onChange={(e) => setWhatsapp(formatWhatsapp(e.target.value))}
            autoComplete="tel"
            className="h-12 rounded-xl border-white/10 bg-[#0e0f11]"
          />
          <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>
        </div>
        <Button
          type="button"
          size="lg"
          disabled={sending || whatsappLookupDelayMs(whatsapp) === null}
          onClick={() => void sendCode()}
          className="mt-4 h-12 w-full rounded-2xl font-semibold"
        >
          {sending ? "Enviando..." : "Receber código no WhatsApp"}
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-2xl bg-[#151618] px-4 py-3.5 ring-1 ring-white/8",
        className
      )}
    >
      <div className="text-center">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          Código enviado
        </p>
        <p className="mt-1 text-[0.95rem] font-semibold tabular-nums tracking-tight text-[#f5f5f5]">
          {formatWhatsapp(whatsapp)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Digite os {OTP_CODE_LENGTH} dígitos · vale {expiresInMinutes} min
        </p>
      </div>

      <div className="mt-3.5">
        <Label htmlFor="clientOtpCode" className="sr-only">
          Código
        </Label>
        <Input
          id="clientOtpCode"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          placeholder={"•".repeat(OTP_CODE_LENGTH)}
          value={code}
          onChange={(e) =>
            setCode(e.target.value.replace(/\D/g, "").slice(0, OTP_CODE_LENGTH))
          }
          onKeyDown={(e) => {
            if (e.key === "Enter" && code.length === OTP_CODE_LENGTH) {
              e.preventDefault();
              void verifyCode();
            }
          }}
          className="h-12 rounded-xl border-white/10 bg-[#0e0f11] text-center text-xl font-semibold tracking-[0.35em] tabular-nums"
        />
      </div>

      <Button
        type="button"
        size="lg"
        disabled={verifying || code.length !== OTP_CODE_LENGTH}
        onClick={() => void verifyCode()}
        className="mt-3 h-11 w-full rounded-2xl font-semibold"
      >
        {verifying ? "Validando..." : "Confirmar código"}
      </Button>

      <div className="mt-2.5 flex items-center justify-center gap-3 text-xs">
        <button
          type="button"
          disabled={sending || verifying}
          onClick={() => void sendCode()}
          className="font-medium text-primary disabled:opacity-50"
        >
          {sending ? "Reenviando..." : "Reenviar"}
        </button>
        <span className="text-white/15" aria-hidden>
          |
        </span>
        <button
          type="button"
          disabled={sending || verifying}
          onClick={() => {
            setPhase("phone");
            setCode("");
          }}
          className="font-medium text-muted-foreground disabled:opacity-50"
        >
          Trocar número
        </button>
      </div>
    </div>
  );
}

export async function logoutClientSession(): Promise<boolean> {
  try {
    const res = await fetch("/api/agenda/session", {
      method: "DELETE",
      credentials: "include",
    });
    return res.ok;
  } catch {
    return false;
  }
}
