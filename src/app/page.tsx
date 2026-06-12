import { isSupabaseConfigured } from "@/lib/supabase/env";
import { AdminLoginScreen } from "@/components/admin/admin-login-screen";

export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  credenciais: "E-mail ou senha incorretos.",
  campos: "Preencha e-mail e senha.",
  perfil:
    "Seu login não tem permissão para o painel. Fale com o dono da barbearia.",
  config:
    "O painel ainda não está ligado ao banco. Cadastre as variáveis do Supabase na Vercel e faça um novo deploy.",
};

type PageProps = {
  searchParams: Promise<{ erro?: string }>;
};

export default async function HomePage({ searchParams }: PageProps) {
  const configured = isSupabaseConfigured();
  const { erro } = await searchParams;
  const errorMessage = erro ? ERROR_MESSAGES[erro] : undefined;

  return (
    <AdminLoginScreen configured={configured} errorMessage={errorMessage} />
  );
}
