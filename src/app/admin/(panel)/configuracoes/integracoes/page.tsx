import Link from "next/link";
import { BookOpen, KeyRound, ChevronRight } from "lucide-react";
import { assertOwnerSettingsPage } from "@/lib/require-owner";
import { PageHeader } from "@/components/admin/page-header";
import { ADMIN_SURFACE } from "@/lib/admin-surface";
import { cn } from "@/lib/utils";

export const metadata = { title: "Integrações" };

export default async function IntegrationsPage() {
  await assertOwnerSettingsPage();

  return (
    <div
      className={cn(
        "admin-page -m-4 flex min-h-full flex-col p-4 md:-m-8 md:p-8",
        ADMIN_SURFACE.page
      )}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <PageHeader
          tone="dark"
          title="Integrações"
          description="Conecte ferramentas externas, como automação de WhatsApp no n8n."
          backHref="/admin/configuracoes"
          backLabel="Configurações"
        />

        <div className={cn(ADMIN_SURFACE.panel, "overflow-hidden p-0")}>
          <Link
            href="/docs/api"
            className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-3.5 transition-colors hover:bg-white/[0.04] sm:gap-4 sm:px-5 sm:py-4"
          >
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#1a1b1e] sm:size-10">
                <BookOpen className={cn("size-4", ADMIN_SURFACE.accent)} />
              </div>
              <div className="min-w-0">
                <p className="text-[15px] font-medium tracking-tight text-[#f5f5f5]">
                  Documentação da API
                </p>
                <p
                  className={cn("mt-0.5 text-xs sm:text-sm", ADMIN_SURFACE.muted)}
                >
                  Abre numa tela só dela — rotas, exemplos e autenticação, com
                  menu fixo.
                </p>
              </div>
            </div>
            <ChevronRight
              className={cn("size-4 shrink-0", ADMIN_SURFACE.muted)}
            />
          </Link>

          <Link
            href="/admin/configuracoes/integracoes/chaves"
            className="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.04] sm:gap-4 sm:px-5 sm:py-4"
          >
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#1a1b1e] sm:size-10">
                <KeyRound className={cn("size-4", ADMIN_SURFACE.accent)} />
              </div>
              <div className="min-w-0">
                <p className="text-[15px] font-medium tracking-tight text-[#f5f5f5]">
                  Chaves de API
                </p>
                <p
                  className={cn("mt-0.5 text-xs sm:text-sm", ADMIN_SURFACE.muted)}
                >
                  Gere chaves para o n8n e outras integrações acessarem a API com
                  segurança.
                </p>
              </div>
            </div>
            <ChevronRight
              className={cn("size-4 shrink-0", ADMIN_SURFACE.muted)}
            />
          </Link>
        </div>
      </div>
    </div>
  );
}
