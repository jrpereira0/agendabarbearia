import Link from "next/link";
import { KeyRound, ChevronRight } from "lucide-react";
import { assertOwnerSettingsPage } from "@/lib/require-owner";
import { PageHeader } from "@/components/admin/page-header";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Integrações" };

export default async function IntegrationsPage() {
  await assertOwnerSettingsPage();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Integrações"
        description="Conecte ferramentas externas, como automação de WhatsApp no n8n."
        backHref="/admin/configuracoes"
      />

      <Card>
        <CardContent className="p-0">
          <Link
            href="/admin/configuracoes/integracoes/chaves"
            className="flex items-center justify-between gap-4 px-4 py-4 transition-colors hover:bg-muted/40 sm:px-6"
          >
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted/50">
                <KeyRound className="size-4" />
              </div>
              <div>
                <p className="text-sm font-medium">Chaves de API</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Gere chaves para o n8n e outras integrações acessarem a API com
                  segurança.
                </p>
              </div>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
