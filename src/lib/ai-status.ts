import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeWhatsapp } from "@/lib/whatsapp";

const LOG_PREFIX = "[ai-status]";

export type AiStatus = {
  whatsapp: string;
  iaAtiva: boolean;
};

/**
 * Sem registro na tabela = IA ativa (mesmo padrão da coluna ia_ativa).
 */
export async function getAiStatus(
  rawWhatsapp: string
): Promise<{ ok: true; status: AiStatus } | { ok: false; error: string; httpStatus: number }> {
  const whatsapp = normalizeWhatsapp(rawWhatsapp);
  if (!whatsapp) {
    return { ok: false, error: "WhatsApp inválido.", httpStatus: 400 };
  }

  const admin = createAdminClient();
  if (!admin) {
    return { ok: false, error: "Sistema indisponível no momento.", httpStatus: 503 };
  }

  const { data, error } = await admin
    .from("dinho_ai_status")
    .select("ia_ativa")
    .eq("session_id", whatsapp)
    .maybeSingle();

  if (error) {
    console.warn(`${LOG_PREFIX} falha ao consultar`, error.message);
    return { ok: false, error: "Não foi possível consultar a IA.", httpStatus: 500 };
  }

  return { ok: true, status: { whatsapp, iaAtiva: data?.ia_ativa ?? true } };
}

export async function setAiStatus(
  rawWhatsapp: string,
  iaAtiva: boolean
): Promise<{ ok: true; status: AiStatus } | { ok: false; error: string; httpStatus: number }> {
  const whatsapp = normalizeWhatsapp(rawWhatsapp);
  if (!whatsapp) {
    return { ok: false, error: "WhatsApp inválido.", httpStatus: 400 };
  }

  const admin = createAdminClient();
  if (!admin) {
    return { ok: false, error: "Sistema indisponível no momento.", httpStatus: 503 };
  }

  const { error } = await admin.from("dinho_ai_status").upsert(
    {
      session_id: whatsapp,
      ia_ativa: iaAtiva,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "session_id" }
  );

  if (error) {
    console.warn(`${LOG_PREFIX} falha ao gravar`, error.message);
    return { ok: false, error: "Não foi possível atualizar a IA.", httpStatus: 500 };
  }

  return { ok: true, status: { whatsapp, iaAtiva } };
}
