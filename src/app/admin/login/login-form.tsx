"use client";

import { useActionState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { login, type LoginState } from "./actions";

type LoginFormProps = {
  configured: boolean;
};

export function LoginForm({ configured }: LoginFormProps) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    login,
    {}
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center px-6">
          <BrandLogo href="/" size="md" />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Área do barbeiro</CardTitle>
            <CardDescription>
              Entre com seu e-mail e senha para acessar o painel.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!configured && (
              <p className="mb-4 text-sm text-muted-foreground" role="status">
                O painel ainda não está ligado ao banco de dados. Na Vercel,
                cadastre as variáveis do Supabase e faça um novo deploy.
              </p>
            )}
            <form action={formAction} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  disabled={pending || !configured}
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
                  disabled={pending || !configured}
                />
              </div>
              {state.error && (
                <p className="text-sm text-destructive" role="alert">
                  {state.error}
                </p>
              )}
              <Button
                type="submit"
                disabled={pending || !configured}
                className="mt-2"
              >
                {pending ? "Entrando..." : "Entrar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
