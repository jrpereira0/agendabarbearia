import { readFile } from "fs/promises";
import path from "path";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { assertOwnerSettingsPage } from "@/lib/require-owner";
import { ApiDocsReference } from "@/components/admin/api-docs-reference";

export default async function StandaloneApiDocsPage() {
  await assertOwnerSettingsPage();

  const filePath = path.join(process.cwd(), "docs", "openapi", "v1.yaml");
  const openApiYaml = await readFile(filePath, "utf8");

  return (
    <div className="api-docs-shell fixed inset-0 z-50 flex h-dvh flex-col overflow-hidden">
      <header className="flex h-[var(--scalar-custom-header-height)] shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[#0e0f11] px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/admin/configuracoes/integracoes"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-white/70 transition-colors hover:bg-white/5 hover:text-white"
          >
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">Integrações</span>
          </Link>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium tracking-tight text-[#f5f5f5]">
              Documentação da API
            </p>
            <p className="hidden truncate text-xs text-white/45 sm:block">
              Referência /api/v1 — n8n, bots e integrações
            </p>
          </div>
        </div>
      </header>

      <ApiDocsReference openApiYaml={openApiYaml} />
    </div>
  );
}
