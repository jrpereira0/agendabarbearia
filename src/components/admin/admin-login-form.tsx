"use client"

import { useState, type CSSProperties } from "react"
import { useFormStatus } from "react-dom"
import { AlertCircle, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react"
import { login } from "@/lib/actions/login"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type AdminLoginFormProps = {
  configured: boolean
  errorMessage?: string
}

function LoginFormFields({ configured }: { configured: boolean }) {
  const { pending } = useFormStatus()
  const disabled = !configured || pending
  const [showPassword, setShowPassword] = useState(false)

  return (
    <>
      <div
        className="login-enter-field flex flex-col gap-2"
        style={{ "--enter-step": 0 } as CSSProperties}
      >
        <Label
          htmlFor="email"
          className="text-[13px] font-medium text-[var(--login-muted)]"
        >
          E-mail
        </Label>
        <div className="relative">
          <Mail
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[var(--login-muted)]"
            aria-hidden
          />
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            disabled={disabled}
            placeholder="seu@email.com"
            className={cn(
              "login-input h-11 rounded-xl border pr-3.5 pl-10 text-[15px] shadow-none sm:h-12",
              "selection:bg-[var(--login-accent)] selection:text-[var(--login-accent-foreground)]"
            )}
          />
        </div>
      </div>

      <div
        className="login-enter-field flex flex-col gap-2"
        style={{ "--enter-step": 1 } as CSSProperties}
      >
        <Label
          htmlFor="password"
          className="text-[13px] font-medium text-[var(--login-muted)]"
        >
          Senha
        </Label>
        <div className="relative">
          <Lock
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[var(--login-muted)]"
            aria-hidden
          />
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            disabled={disabled}
            placeholder="••••••••"
            className={cn(
              "login-input h-11 rounded-xl border pr-11 pl-10 text-[15px] shadow-none sm:h-12",
              "selection:bg-[var(--login-accent)] selection:text-[var(--login-accent-foreground)]"
            )}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            disabled={disabled}
            className="absolute top-1/2 right-2.5 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--login-muted)] transition-colors hover:text-white disabled:pointer-events-none"
            aria-label={showPassword ? "Esconder senha" : "Mostrar senha"}
          >
            {showPassword ? (
              <EyeOff className="size-4" aria-hidden />
            ) : (
              <Eye className="size-4" aria-hidden />
            )}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={disabled}
        aria-busy={pending}
        style={{ "--enter-step": 2 } as CSSProperties}
        className={cn(
          "login-enter-field login-btn-primary mt-1 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-[15px] font-semibold tracking-tight sm:h-12",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--login-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--login-card)]",
          "disabled:pointer-events-none"
        )}
      >
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Entrando…
          </>
        ) : (
          "Entrar"
        )}
      </button>
    </>
  )
}

export function AdminLoginForm({
  configured,
  errorMessage,
}: AdminLoginFormProps) {
  return (
    <>
      {!configured && (
        <div
          className="login-alert login-alert-warn mb-5 flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm leading-snug"
          role="status"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0 opacity-80" aria-hidden />
          <span>
            O painel ainda não está ligado ao banco. Cadastre as variáveis do
            Supabase e reinicie o app.
          </span>
        </div>
      )}

      {errorMessage && (
        <div
          className="login-alert mb-5 flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm leading-snug"
          role="alert"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-[var(--login-accent)]" aria-hidden />
          <span>{errorMessage}</span>
        </div>
      )}

      <form action={login} className="flex flex-col gap-4 sm:gap-5">
        <LoginFormFields configured={configured} />
      </form>
    </>
  )
}
