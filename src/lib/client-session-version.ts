import type { ClientSessionPayload } from "@/lib/client-api-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeWhatsapp } from "@/lib/whatsapp";

const LOG_PREFIX = "[client-session-version]";

/** Sem registro salvo = versão 0 (nenhum "sair de todos os aparelhos" ainda). */
export async function getClientSessionVersion(rawWhatsapp: string): Promise<number> {
  const whatsapp = normalizeWhatsapp(rawWhatsapp);
  if (!whatsapp) return 0;

  const admin = createAdminClient();
  if (!admin) return 0;

  const { data, error } = await admin
    .from("client_session_versions")
    .select("version")
    .eq("whatsapp", whatsapp)
    .maybeSingle();

  if (error) {
    console.warn(`${LOG_PREFIX} falha ao consultar`, error.message);
    return 0;
  }

  return data?.version ?? 0;
}

export type BumpSessionVersionResult =
  | { ok: true; version: number }
  | { ok: false; error: string; httpStatus: number };

/**
 * Sobe a versão da sessão daquele WhatsApp, invalidando todo cookie/token
 * já emitido (o próprio, de outros aparelhos, ou do site).
 */
export async function bumpClientSessionVersion(
  rawWhatsapp: string
): Promise<BumpSessionVersionResult> {
  const whatsapp = normalizeWhatsapp(rawWhatsapp);
  if (!whatsapp) {
    return { ok: false, error: "WhatsApp inválido.", httpStatus: 400 };
  }

  const admin = createAdminClient();
  if (!admin) {
    return { ok: false, error: "Sistema indisponível no momento.", httpStatus: 503 };
  }

  const { data: existing, error: selectError } = await admin
    .from("client_session_versions")
    .select("version")
    .eq("whatsapp", whatsapp)
    .maybeSingle();

  if (selectError) {
    console.warn(`${LOG_PREFIX} falha ao consultar`, selectError.message);
    return {
      ok: false,
      error: "Não foi possível encerrar as sessões.",
      httpStatus: 500,
    };
  }

  const nextVersion = (existing?.version ?? 0) + 1;

  const { error: upsertError } = await admin
    .from("client_session_versions")
    .upsert(
      { whatsapp, version: nextVersion, updated_at: new Date().toISOString() },
      { onConflict: "whatsapp" }
    );

  if (upsertError) {
    console.warn(`${LOG_PREFIX} falha ao gravar`, upsertError.message);
    return {
      ok: false,
      error: "Não foi possível encerrar as sessões.",
      httpStatus: 500,
    };
  }

  return { ok: true, version: nextVersion };
}

/**
 * Confirma que um payload de sessão já validado por criptografia ainda vale
 * (não foi revogado por um "sair de todos os aparelhos" depois de emitido).
 * Devolve o próprio payload se válido, ou null se foi revogado.
 */
export async function resolveValidClientSession(
  payload: ClientSessionPayload | null
): Promise<ClientSessionPayload | null> {
  if (!payload) return null;

  const currentVersion = await getClientSessionVersion(payload.whatsapp);
  if (payload.v < currentVersion) return null;

  return payload;
}
