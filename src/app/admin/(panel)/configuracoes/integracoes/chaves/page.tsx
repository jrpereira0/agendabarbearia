import { assertOwnerSettingsPage } from "@/lib/require-owner";
import { requireAdminClient, systemUnavailable } from "@/lib/supabase/admin";
import { isActionResult } from "@/lib/is-action-result";
import { PageHeader } from "@/components/admin/page-header";
import { ApiKeysPanel } from "@/components/admin/api-keys-panel";
import { SHOP_ID } from "@/lib/api-key-auth";
import type { ApiKeyListItem } from "@/lib/api-key-service";
import { ADMIN_SURFACE } from "@/lib/admin-surface";
import { cn } from "@/lib/utils";

export const metadata = { title: "Chaves de API" };

const LIST_COLUMNS =
  "id, name, key_prefix, scopes, active, created_at, last_used_at, expires_at, revoked_at";

function mapRow(row: {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  active: boolean;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
}): ApiKeyListItem {
  return {
    id: row.id,
    name: row.name,
    keyPrefix: row.key_prefix,
    scopes: row.scopes,
    active: row.active,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
  };
}

export default async function ApiKeysPage() {
  await assertOwnerSettingsPage();

  const admin = requireAdminClient();
  if (isActionResult(admin)) {
    return (
      <div
        className={cn(
          "admin-page -m-4 flex min-h-full flex-col p-4 md:-m-8 md:p-8",
          ADMIN_SURFACE.page
        )}
      >
        <PageHeader
          tone="dark"
          title="Chaves de API"
          description={systemUnavailable().error}
          backHref="/admin/configuracoes/integracoes"
          backLabel="Integrações"
        />
      </div>
    );
  }

  const { data } = await admin
    .from("api_keys")
    .select(LIST_COLUMNS)
    .eq("shop_id", SHOP_ID)
    .order("created_at", { ascending: false });

  const keys = (data ?? []).map(mapRow);

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
          title="Chaves de API"
          description="Use no n8n ou em outras automações. A chave completa só aparece na criação."
          backHref="/admin/configuracoes/integracoes"
          backLabel="Integrações"
        />

        <ApiKeysPanel initialKeys={keys} />
      </div>
    </div>
  );
}
