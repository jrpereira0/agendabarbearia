import { requireAdminClient } from "@/lib/supabase/admin";
import { isActionResult } from "@/lib/is-action-result";
import {
  buildFullApiKey,
  generateApiKeyMaterial,
  hashApiKeySecret,
} from "@/lib/api-key-crypto";
import {
  normalizeScopes,
  scopesFromPreset,
  type ApiKeyPermissionPreset,
  type ApiScope,
} from "@/lib/api-key-scopes";
import { SHOP_ID } from "@/lib/api-key-auth";
import type { ActionResult } from "@/lib/require-owner";

export type ApiKeyListItem = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  active: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
};

export type CreateApiKeyResult =
  | { ok: true; key: ApiKeyListItem; secret: string; fullKey: string }
  | { ok: false; error: string };

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

export async function listApiKeysForOwner(): Promise<
  ActionResult & { keys?: ApiKeyListItem[] }
> {
  const admin = requireAdminClient();
  if (isActionResult(admin)) {
    return { ok: false, error: admin.error };
  }

  const { data, error } = await admin
    .from("api_keys")
    .select(LIST_COLUMNS)
    .eq("shop_id", SHOP_ID)
    .order("created_at", { ascending: false });

  if (error) {
    return { ok: false, error: "Não foi possível carregar as chaves." };
  }

  return {
    ok: true,
    keys: (data ?? []).map(mapRow),
  };
}

export async function createApiKeyForOwner(input: {
  name: string;
  preset: ApiKeyPermissionPreset;
  customScopes?: ApiScope[];
  expiresAt?: string | null;
  createdBy: string;
}): Promise<CreateApiKeyResult> {
  const admin = requireAdminClient();
  if (isActionResult(admin)) {
    return { ok: false, error: admin.error };
  }

  const name = input.name.trim();
  if (!name) {
    return { ok: false, error: "Informe um nome para a chave." };
  }

  const scopes =
    input.preset === "custom"
      ? normalizeScopes(input.customScopes ?? [])
      : scopesFromPreset(input.preset);

  if (scopes.length === 0) {
    return { ok: false, error: "Selecione pelo menos uma permissão." };
  }

  if (input.expiresAt) {
    const expires = new Date(input.expiresAt);
    if (Number.isNaN(expires.getTime()) || expires <= new Date()) {
      return { ok: false, error: "Data de expiração inválida." };
    }
  }

  const material = generateApiKeyMaterial();
  const secretHash = await hashApiKeySecret(material.secret);

  const { data, error } = await admin
    .from("api_keys")
    .insert({
      shop_id: SHOP_ID,
      name,
      key_prefix: material.keyPrefix,
      secret_hash: secretHash,
      scopes,
      active: true,
      created_by: input.createdBy,
      expires_at: input.expiresAt ?? null,
    })
    .select(LIST_COLUMNS)
    .single();

  if (error || !data) {
    return { ok: false, error: "Não foi possível criar a chave." };
  }

  return {
    ok: true,
    key: mapRow(data),
    secret: material.secret,
    fullKey: buildFullApiKey(material.keyId, material.secret),
  };
}

export async function revokeApiKeyForOwner(
  keyId: string
): Promise<ActionResult> {
  const admin = requireAdminClient();
  if (isActionResult(admin)) {
    return { ok: false, error: admin.error };
  }

  const { data: existing } = await admin
    .from("api_keys")
    .select("id, revoked_at")
    .eq("id", keyId)
    .eq("shop_id", SHOP_ID)
    .maybeSingle();

  if (!existing) {
    return { ok: false, error: "Chave não encontrada." };
  }

  if (existing.revoked_at) {
    return { ok: false, error: "Essa chave já foi revogada." };
  }

  const { error } = await admin
    .from("api_keys")
    .update({
      active: false,
      revoked_at: new Date().toISOString(),
    })
    .eq("id", keyId)
    .eq("shop_id", SHOP_ID);

  if (error) {
    return { ok: false, error: "Não foi possível revogar a chave." };
  }

  return { ok: true };
}

export async function rotateApiKeyForOwner(input: {
  oldKeyId: string;
  name: string;
  preset: ApiKeyPermissionPreset;
  customScopes?: ApiScope[];
  expiresAt?: string | null;
  createdBy: string;
  revokeOld: boolean;
}): Promise<CreateApiKeyResult> {
  const admin = requireAdminClient();
  if (isActionResult(admin)) {
    return { ok: false, error: admin.error };
  }

  const { data: existing } = await admin
    .from("api_keys")
    .select("id, revoked_at")
    .eq("id", input.oldKeyId)
    .eq("shop_id", SHOP_ID)
    .maybeSingle();

  if (!existing) {
    return { ok: false, error: "Chave original não encontrada." };
  }

  if (existing.revoked_at) {
    return { ok: false, error: "A chave original já foi revogada." };
  }

  const created = await createApiKeyForOwner({
    name: input.name,
    preset: input.preset,
    customScopes: input.customScopes,
    expiresAt: input.expiresAt,
    createdBy: input.createdBy,
  });

  if (!created.ok) {
    return created;
  }

  if (input.revokeOld) {
    await revokeApiKeyForOwner(input.oldKeyId);
  }

  return created;
}
