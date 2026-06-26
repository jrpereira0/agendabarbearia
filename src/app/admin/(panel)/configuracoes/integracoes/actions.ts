"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOwner, type ActionResult } from "@/lib/require-owner";
import {
  createApiKeyForOwner,
  revokeApiKeyForOwner,
  rotateApiKeyForOwner,
  type CreateApiKeyResult,
} from "@/lib/api-key-service";
import type {
  ApiKeyPermissionPreset,
  ApiScope,
} from "@/lib/api-key-scopes";

async function getOwnerUserId(): Promise<string | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function createApiKeyAction(input: {
  name: string;
  preset: ApiKeyPermissionPreset;
  customScopes?: ApiScope[];
  expiresAt?: string | null;
}): Promise<CreateApiKeyResult> {
  const auth = await requireOwner();
  if (auth !== null && !auth.ok) return { ok: false, error: auth.error };

  const userId = await getOwnerUserId();
  if (!userId) {
    return { ok: false, error: "Você precisa estar logado." };
  }

  const result = await createApiKeyForOwner({
    ...input,
    createdBy: userId,
  });

  if (result.ok) {
    revalidatePath("/admin/configuracoes/integracoes/chaves");
  }

  return result;
}

export async function revokeApiKeyAction(keyId: string): Promise<ActionResult> {
  const auth = await requireOwner();
  if (auth !== null && !auth.ok) return { ok: false, error: auth.error };

  const result = await revokeApiKeyForOwner(keyId);
  if (result.ok) {
    revalidatePath("/admin/configuracoes/integracoes/chaves");
  }
  return result;
}

export async function rotateApiKeyAction(input: {
  oldKeyId: string;
  name: string;
  preset: ApiKeyPermissionPreset;
  customScopes?: ApiScope[];
  expiresAt?: string | null;
  revokeOld: boolean;
}): Promise<CreateApiKeyResult> {
  const auth = await requireOwner();
  if (auth !== null && !auth.ok) return { ok: false, error: auth.error };

  const userId = await getOwnerUserId();
  if (!userId) {
    return { ok: false, error: "Você precisa estar logado." };
  }

  const result = await rotateApiKeyForOwner({
    ...input,
    createdBy: userId,
  });

  if (result.ok) {
    revalidatePath("/admin/configuracoes/integracoes/chaves");
  }

  return result;
}
