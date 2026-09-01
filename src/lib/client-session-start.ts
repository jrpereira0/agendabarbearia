import {
  createClientSessionToken,
  verifyClientSessionToken,
} from "@/lib/client-api-session";
import { getClientSessionVersion } from "@/lib/client-session-version";
import {
  normalizeWhatsapp,
  WHATSAPP_INVALID_MESSAGE,
} from "@/lib/whatsapp";

export type ClientSessionStartResult =
  | { ok: true; whatsapp: string; accessToken: string; expiresAt: number }
  | { ok: false; error: string; status: number };

/** Abre sessão do cliente (cookie / Bearer) sem OTP. */
export async function startClientSession(
  rawWhatsapp: string
): Promise<ClientSessionStartResult> {
  const whatsapp = normalizeWhatsapp(rawWhatsapp);
  if (!whatsapp) {
    return { ok: false, error: WHATSAPP_INVALID_MESSAGE, status: 400 };
  }

  const sessionVersion = await getClientSessionVersion(whatsapp);
  const token = createClientSessionToken(whatsapp, sessionVersion);
  if (!token) {
    return {
      ok: false,
      error: "Não foi possível iniciar a sessão.",
      status: 503,
    };
  }

  const session = verifyClientSessionToken(token);
  return {
    ok: true,
    whatsapp,
    accessToken: token,
    expiresAt: session?.exp ?? Date.now(),
  };
}
