import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  hashApiKeySecret,
  parseBearerApiKey,
  verifyApiKeySecret,
} from "@/lib/api-key-crypto";
import { hasScope, type ApiScope } from "@/lib/api-key-scopes";

export const SHOP_ID = 1;

export const API_UNAUTHORIZED = NextResponse.json(
  { ok: false, error: "Não autorizado." },
  { status: 401 }
);

export const API_FORBIDDEN = NextResponse.json(
  { ok: false, error: "Sem permissão." },
  { status: 403 }
);

export type ApiKeyAuthContext = {
  type: "api_key";
  shopId: number;
  keyId: string;
  keyUuid: string;
  scopes: string[];
};

export type PublicApiAuthContext = {
  type: "public";
};

export type ResolvedApiAuth = ApiKeyAuthContext | PublicApiAuthContext;

type ApiKeyRow = {
  id: string;
  shop_id: number;
  secret_hash: string;
  scopes: string[];
  active: boolean;
  expires_at: string | null;
  revoked_at: string | null;
};

export function getAuthorizationHeader(request: Request): string | null {
  return request.headers.get("authorization");
}

export function hasBearerAuthorization(request: Request): boolean {
  const header = getAuthorizationHeader(request);
  return header?.startsWith("Bearer ") === true;
}

export async function validateApiKeyFromRequest(
  request: Request,
  requiredScope: ApiScope
): Promise<
  | { ok: true; auth: ApiKeyAuthContext }
  | { ok: false; response: NextResponse }
> {
  const parsed = parseBearerApiKey(getAuthorizationHeader(request));
  if (!parsed) {
    return { ok: false, response: API_UNAUTHORIZED };
  }

  const validated = await validateApiKeyRecord(
    parsed.keyPrefix,
    parsed.secret,
    requiredScope
  );
  if (!validated.ok) {
    return validated;
  }

  return { ok: true, auth: validated.auth };
}

export async function validateApiKeyRecord(
  keyPrefix: string,
  secret: string,
  requiredScope: ApiScope
): Promise<
  | { ok: true; auth: ApiKeyAuthContext }
  | { ok: false; response: NextResponse }
> {
  const admin = createAdminClient();
  if (!admin) {
    return { ok: false, response: API_UNAUTHORIZED };
  }

  const { data, error } = await admin
    .from("api_keys")
    .select("id, shop_id, secret_hash, scopes, active, expires_at, revoked_at")
    .eq("key_prefix", keyPrefix)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, response: API_UNAUTHORIZED };
  }

  const row = data as ApiKeyRow;

  if (!row.active || row.revoked_at) {
    return { ok: false, response: API_UNAUTHORIZED };
  }

  if (row.expires_at && new Date(row.expires_at) <= new Date()) {
    return { ok: false, response: API_UNAUTHORIZED };
  }

  const secretOk = await verifyApiKeySecret(secret, row.secret_hash);
  if (!secretOk) {
    return { ok: false, response: API_UNAUTHORIZED };
  }

  if (!hasScope(row.scopes, requiredScope)) {
    return { ok: false, response: API_FORBIDDEN };
  }

  touchApiKeyLastUsed(row.id);

  return {
    ok: true,
    auth: {
      type: "api_key",
      shopId: row.shop_id,
      keyId: keyPrefix.replace(/^dbc_live_/, ""),
      keyUuid: row.id,
      scopes: row.scopes,
    },
  };
}

function touchApiKeyLastUsed(keyUuid: string): void {
  const admin = createAdminClient();
  if (!admin) return;

  void admin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyUuid)
    .then(() => undefined);
}

export async function resolveApiAuth(
  request: Request,
  requiredScope: ApiScope
): Promise<
  | { ok: true; auth: ResolvedApiAuth }
  | { ok: false; response: NextResponse }
> {
  if (!hasBearerAuthorization(request)) {
    return { ok: true, auth: { type: "public" } };
  }

  const result = await validateApiKeyFromRequest(request, requiredScope);
  if (!result.ok) {
    return result;
  }

  return { ok: true, auth: result.auth };
}

export { hashApiKeySecret };
