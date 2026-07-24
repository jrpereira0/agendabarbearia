import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeWhatsapp, whatsappLookupKeys } from "@/lib/whatsapp";

const LOG_PREFIX = "[customer-push-tokens]";

export async function upsertCustomerPushToken(input: {
  whatsapp: string;
  expoPushToken: string;
  platform?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string; httpStatus: number }> {
  const whatsapp = normalizeWhatsapp(input.whatsapp);
  const token = input.expoPushToken.trim();
  if (!whatsapp) {
    return { ok: false, error: "WhatsApp inválido.", httpStatus: 400 };
  }
  if (!token.startsWith("ExponentPushToken[") && !token.startsWith("ExpoPushToken[")) {
    return { ok: false, error: "Token de push inválido.", httpStatus: 400 };
  }

  const admin = createAdminClient();
  if (!admin) {
    return { ok: false, error: "Sistema indisponível no momento.", httpStatus: 503 };
  }

  const now = new Date().toISOString();
  const { error } = await admin.from("customer_push_tokens").upsert(
    {
      whatsapp,
      expo_push_token: token,
      platform: input.platform?.trim() || null,
      updated_at: now,
    },
    { onConflict: "expo_push_token" }
  );

  if (error) {
    console.warn(`${LOG_PREFIX} falha ao gravar token`, error.message);
    return { ok: false, error: "Não foi possível salvar o token.", httpStatus: 500 };
  }

  return { ok: true };
}

export async function deleteCustomerPushToken(input: {
  whatsapp: string;
  expoPushToken?: string;
}): Promise<void> {
  const whatsapp = normalizeWhatsapp(input.whatsapp);
  if (!whatsapp) return;

  const admin = createAdminClient();
  if (!admin) return;

  let query = admin
    .from("customer_push_tokens")
    .delete()
    .in("whatsapp", whatsappLookupKeys(whatsapp));

  if (input.expoPushToken?.trim()) {
    query = query.eq("expo_push_token", input.expoPushToken.trim());
  }

  const { error } = await query;
  if (error) {
    console.warn(`${LOG_PREFIX} falha ao remover token`, error.message);
  }
}

export async function listExpoPushTokensForWhatsapp(
  rawWhatsapp: string
): Promise<string[]> {
  const whatsapp = normalizeWhatsapp(rawWhatsapp);
  if (!whatsapp) return [];

  const admin = createAdminClient();
  if (!admin) return [];

  const { data, error } = await admin
    .from("customer_push_tokens")
    .select("expo_push_token")
    .in("whatsapp", whatsappLookupKeys(whatsapp));

  if (error || !data?.length) return [];
  return data.map((row) => row.expo_push_token).filter(Boolean);
}
