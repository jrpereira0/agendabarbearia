import Link from "next/link";
import { KeyRound, ChevronRight } from "lucide-react";
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
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <PageHeader
          tone="dark"
          title="Integrações"
          description="Conecte ferramentas externas, como automação de WhatsApp no n8n."
          backHref="/admin/configuracoes"
          backLabel="Configurações"
        />

        <div className={cn(ADMIN_SURFACE.panel, "overflow-hidden p-0")}>
          <Link
            href="/admin/configuracoes/integracoes/chaves"
            className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-white/[0.04] sm:px-6"
          >
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#1a1b1e]">
                <KeyRound className={cn("size-4", ADMIN_SURFACE.accent)} />
              </div>
              <div>
                <p className="text-sm font-medium text-[#f5f5f5]">
                  Chaves de API
                </p>
                <p className={cn("mt-0.5 text-sm", ADMIN_SURFACE.muted)}>
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
