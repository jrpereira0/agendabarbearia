import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { type ApiScope } from "@/lib/api-key-scopes";
import {
  apiForbiddenResponse,
  apiUnauthorizedResponse,
  getAuthorizationHeader,
  validateApiKeyFromRequest,
  type ApiKeyAuthContext,
} from "@/lib/api-key-auth";
import { parseBearerApiKey } from "@/lib/api-key-crypto";
import {
  extractBearerToken,
  readClientSessionFromRequest,
  verifyClientSessionToken,
} from "@/lib/client-api-session";
import { normalizeWhatsapp } from "@/lib/whatsapp";

export type AdminApiAuthContext = {
  type: "admin";
  userId: string;
  role: "owner" | "barber";
};

export type ClientApiAuthContext = {
  type: "client";
  whatsapp: string;
};

export type ProtectedApiAuthContext =
  | ApiKeyAuthContext
  | AdminApiAuthContext
  | ClientApiAuthContext;

const CLIENT_SESSION_SCOPES: ApiScope[] = [
  "customers:read",
  "customers:update",
  "appointments:read",
  "appointments:create",
  "appointments:update",
  "appointments:cancel",
];

// Escopos liberados para barbeiro autenticado com sessão do painel (cookie).
// Não inclui "customers:read" nem "appointments:read": essas rotas devolvem
// dados de QUALQUER WhatsApp informado, sem restringir ao próprio barbeiro,
// então um barbeiro logado poderia ler clientes/agendamentos de terceiros.
const BARBER_SESSION_SCOPES: ApiScope[] = [
  "catalog:read",
  "availability:read",
];

function adminHasScope(role: "owner" | "barber", scope: ApiScope): boolean {
  if (role === "owner") return true;
  return BARBER_SESSION_SCOPES.includes(scope);
}

function clientHasScope(scope: ApiScope): boolean {
  return CLIENT_SESSION_SCOPES.includes(scope);
}

function buildClientAuth(
  whatsapp: string,
  requiredScope: ApiScope,
  requestedWhatsapp?: string | null
): ClientApiAuthContext | null {
  if (!clientHasScope(requiredScope)) return null;

  if (requestedWhatsapp) {
    const requested = normalizeWhatsapp(requestedWhatsapp);
    if (!requested || requested !== whatsapp) return null;
  }

  return { type: "client", whatsapp };
}

export async function getAdminApiSession(): Promise<AdminApiAuthContext | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "owner" && profile?.role !== "barber") {
    return null;
  }

  return {
    type: "admin",
    userId: user.id,
    role: profile.role,
  };
}

export type ProtectedAuthOptions = {
  /** WhatsApp da requisição — obrigatório para sessão de cliente. */
  whatsapp?: string | null;
};

export async function resolveProtectedApiAuth(
  request: Request,
  requiredScope: ApiScope,
  options: ProtectedAuthOptions = {}
): Promise<
  | { ok: true; auth: ProtectedApiAuthContext }
  | { ok: false; response: NextResponse }
> {
  const authorization = getAuthorizationHeader(request);

  if (authorization !== null) {
    if (!authorization.startsWith("Bearer ")) {
      return { ok: false, response: apiUnauthorizedResponse() };
    }

    // Chave de API (n8n / integrações)
    if (parseBearerApiKey(authorization)) {
      const apiKey = await validateApiKeyFromRequest(request, requiredScope);
      if (!apiKey.ok) {
        return apiKey;
      }
      return { ok: true, auth: apiKey.auth };
    }

    // Token de sessão do cliente (app mobile)
    const bearer = extractBearerToken(request);
    const bearerSession = verifyClientSessionToken(bearer);
    if (bearerSession) {
      const clientAuth = buildClientAuth(
        bearerSession.whatsapp,
        requiredScope,
        options.whatsapp
      );
      if (clientAuth) {
        return { ok: true, auth: clientAuth };
      }
      return { ok: false, response: apiForbiddenResponse() };
    }

    return { ok: false, response: apiUnauthorizedResponse() };
  }

  const clientSession = readClientSessionFromRequest(request);
  const clientAuth = clientSession
    ? buildClientAuth(
        clientSession.whatsapp,
        requiredScope,
        options.whatsapp
      )
    : null;

  // Preferir sessão OTP do cliente quando o WhatsApp da requisição bate com ela.
  // Assim Agendar/Horários funcionam mesmo com o painel aberto no mesmo navegador.
  if (clientAuth && options.whatsapp) {
    return { ok: true, auth: clientAuth };
  }

  const admin = await getAdminApiSession();
  if (admin && adminHasScope(admin.role, requiredScope)) {
    return { ok: true, auth: admin };
  }

  if (clientAuth) {
    return { ok: true, auth: clientAuth };
  }

  if (admin) {
    return { ok: false, response: apiForbiddenResponse() };
  }

  if (clientSession && !clientHasScope(requiredScope)) {
    return { ok: false, response: apiForbiddenResponse() };
  }

  if (clientSession && options.whatsapp) {
    return { ok: false, response: apiForbiddenResponse() };
  }

  return { ok: false, response: apiUnauthorizedResponse() };
}

export function protectedAuthRateLimitKey(
  auth: ProtectedApiAuthContext
): string | undefined {
  if (auth.type === "api_key") return auth.keyUuid;
  if (auth.type === "client") return `client:${auth.whatsapp}`;
  if (auth.type === "admin") return `admin:${auth.userId}`;
  return undefined;
}
