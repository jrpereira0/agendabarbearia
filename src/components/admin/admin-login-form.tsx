"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { login } from "@/lib/actions/login";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AdminLoginFormProps = {
  configured: boolean;
  errorMessage?: string;
};

function LoginFormFields({ configured }: { configured: boolean }) {
  const { pending } = useFormStatus();
  const disabled = !configured || pending;

  return (
    <>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          disabled={disabled}
          placeholder="seu@email.com"
          className="h-11"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          disabled={disabled}
          placeholder="••••••••"
          className="h-11"
        />
      </div>
      <Button
        type="submit"
        disabled={disabled}
        size="lg"
        className="mt-1 h-11 w-full text-base"
        aria-busy={pending}
      >
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Entrando…
          </>
        ) : (
          "Entrar no painel"
        )}
      </Button>
    </>
  );
}

export function AdminLoginForm({ configured, errorMessage }: AdminLoginFormProps) {
  return (
    <>
      {errorMessage && (
        <div
          className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {errorMessage}
        </div>
      )}

      <form action={login} className="flex flex-col gap-5">
        <LoginFormFields configured={configured} />
      </form>
    </>
  );
}
