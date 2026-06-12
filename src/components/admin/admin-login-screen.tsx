import { Lock } from "lucide-react";
import { BrandLogo, BrandMark } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "@/lib/actions/login";

type AdminLoginScreenProps = {
  configured: boolean;
  errorMessage?: string;
};

export function AdminLoginScreen({
  configured,
  errorMessage,
}: AdminLoginScreenProps) {
  return (
    <div className="flex min-h-dvh bg-background">
      <aside className="relative hidden w-[min(44%,520px)] shrink-0 flex-col justify-between overflow-hidden border-r bg-foreground p-10 text-background lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        <div className="relative">
          <BrandLogo
            size="lg"
            nameClassName="text-background"
            className="text-background"
          />
        </div>

        <div className="relative space-y-5">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-background/50">
            Painel administrativo
          </p>
          <h1 className="max-w-xs text-3xl font-semibold leading-tight tracking-tight">
            Sua barbearia, organizada de ponta a ponta.
          </h1>
          <p className="max-w-sm text-sm leading-relaxed text-background/65">
            Agenda do dia, clientes, profissionais e serviços — tudo em um lugar
            só, feito para quem está na correria do salão.
          </p>
        </div>

        <p className="relative text-xs text-background/45">
          Acesso restrito à equipe
        </p>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center border-b px-5 py-4 sm:px-8 lg:hidden">
          <BrandLogo size="md" />
        </header>

        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-[400px]">
            <div className="mb-8 flex flex-col items-center text-center lg:items-start lg:text-left">
              <BrandMark className="mb-5 size-16 rounded-2xl border-border lg:hidden" />
              <div className="mb-3 hidden size-11 items-center justify-center rounded-xl border bg-muted/40 lg:flex">
                <Lock className="size-5 text-foreground" aria-hidden />
              </div>
              <h2 className="text-2xl font-semibold tracking-tight">
                Entrar no painel
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Use o e-mail e a senha que você recebeu para acessar a agenda e
                o cadastro da barbearia.
              </p>
            </div>

            {!configured && (
              <div
                className="mb-6 rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground"
                role="status"
              >
                O painel ainda não está ligado ao banco de dados. Na Vercel,
                cadastre as variáveis do Supabase e faça um novo deploy.
              </div>
            )}

            {errorMessage && (
              <div
                className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
                role="alert"
              >
                {errorMessage}
              </div>
            )}

            <form action={login} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  disabled={!configured}
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
                  disabled={!configured}
                  placeholder="••••••••"
                  className="h-11"
                />
              </div>
              <Button
                type="submit"
                disabled={!configured}
                size="lg"
                className="mt-1 h-11 w-full text-base"
              >
                Entrar no painel
              </Button>
            </form>

            <p className="mt-8 text-center text-xs text-muted-foreground lg:text-left">
              Problemas para entrar? Fale com o dono da barbearia.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
