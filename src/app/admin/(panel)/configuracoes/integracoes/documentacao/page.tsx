import { readFile } from "fs/promises";
import path from "path";
import { assertOwnerSettingsPage } from "@/lib/require-owner";
import { PageHeader } from "@/components/admin/page-header";
import { ApiDocsReference } from "@/components/admin/api-docs-reference";
import { ADMIN_SURFACE } from "@/lib/admin-surface";
import { cn } from "@/lib/utils";

export const metadata = { title: "Documentação da API" };

export default async function ApiDocumentationPage() {
  await assertOwnerSettingsPage();

  const filePath = path.join(process.cwd(), "docs", "openapi", "v1.yaml");
  const openApiYaml = await readFile(filePath, "utf8");

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
          title="Documentação da API"
          description="Referência interativa das rotas em /api/v1 — útil pra n8n, bots e ChatGPT."
          backHref="/admin/configuracoes/integracoes"
          backLabel="Integrações"
        />

        <ApiDocsReference openApiYaml={openApiYaml} />
      </div>
    </div>
  );
}
