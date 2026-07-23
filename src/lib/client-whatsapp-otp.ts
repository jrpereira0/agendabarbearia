import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendClientOtpWebhook } from "@/lib/notifications/client-otp-webhook";
import { normalizeWhatsapp } from "@/lib/whatsapp";
import { BRAND_NAME } from "@/lib/brand";
import {
  OTP_CODE_LENGTH,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MINUTES,
} from "@/lib/client-whatsapp-otp-constants";

export {
  OTP_CODE_LENGTH,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MINUTES,
} from "@/lib/client-whatsapp-otp-constants";

function hashOtpCode(whatsapp: string, code: string): string {
  return createHash("sha256")
    .update(`${whatsapp}:${code}`)
    .digest("hex");
}

function generateOtpCode(): string {
  const max = 10 ** OTP_CODE_LENGTH;
  return String(randomInt(0, max)).padStart(OTP_CODE_LENGTH, "0");
}

function codesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

async function loadShopName(): Promise<string> {
  const admin = createAdminClient();
  if (!admin) return BRAND_NAME;
  const { data } = await admin
    .from("shop_settings")
    .select("shop_name")
    .eq("id", 1)
    .maybeSingle();
  return data?.shop_name?.trim() || BRAND_NAME;
}

export async function requestClientWhatsappOtp(
  rawWhatsapp: string
): Promise<{ ok: true; expiresInMinutes: number } | { ok: false; error: string; status: number }> {
  const whatsapp = normalizeWhatsapp(rawWhatsapp);
  if (!whatsapp) {
    return { ok: false, error: "Informe um WhatsApp válido.", status: 400 };
  }

  const admin = createAdminClient();
  if (!admin) {
    return { ok: false, error: "Serviço indisponível.", status: 503 };
  }

  const code = generateOtpCode();
  const codeHash = hashOtpCode(whatsapp, code);
  const expiresAt = new Date(
    Date.now() + OTP_TTL_MINUTES * 60 * 1000
  ).toISOString();

  // Invalida códigos anteriores ainda abertos deste número.
  await admin
    .from("client_whatsapp_otps")
    .update({ consumed_at: new Date().toISOString() })
    .eq("whatsapp", whatsapp)
    .is("consumed_at", null);

  const { error: insertError } = await admin.from("client_whatsapp_otps").insert({
    whatsapp,
    code_hash: codeHash,
    expires_at: expiresAt,
    max_attempts: OTP_MAX_ATTEMPTS,
  });

  if (insertError) {
    console.error("[client-otp] falha ao gravar código", insertError);
    return {
      ok: false,
      error: "Não foi possível gerar o código. Tente de novo.",
      status: 500,
    };
  }

  const shopName = await loadShopName();
  const message = `${shopName}: seu código de acesso é ${code}. Vale por ${OTP_TTL_MINUTES} minutos. Não compartilhe.`;

  const sent = await sendClientOtpWebhook({
    event: "client.otp",
    whatsapp,
    code,
    expiresInMinutes: OTP_TTL_MINUTES,
    shop: { name: shopName },
    message,
  });

  if (!sent.ok) {
    return { ok: false, error: sent.error, status: 502 };
  }

  return { ok: true, expiresInMinutes: OTP_TTL_MINUTES };
}

export async function verifyClientWhatsappOtp(
  rawWhatsapp: string,
  rawCode: string
): Promise<{ ok: true; whatsapp: string } | { ok: false; error: string; status: number }> {
  const whatsapp = normalizeWhatsapp(rawWhatsapp);
  const code = rawCode.replace(/\D/g, "").trim();

  if (!whatsapp) {
    return { ok: false, error: "Informe um WhatsApp válido.", status: 400 };
  }
  if (code.length !== OTP_CODE_LENGTH) {
    return {
      ok: false,
      error: `Digite o código de ${OTP_CODE_LENGTH} dígitos.`,
      status: 400,
    };
  }

  const admin = createAdminClient();
  if (!admin) {
    return { ok: false, error: "Serviço indisponível.", status: 503 };
  }

  const { data: row, error } = await admin
    .from("client_whatsapp_otps")
    .select("id, code_hash, expires_at, attempts, max_attempts, consumed_at")
    .eq("whatsapp", whatsapp)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[client-otp] falha ao buscar código", error);
    return {
      ok: false,
      error: "Não foi possível validar o código. Tente de novo.",
      status: 500,
    };
  }

  if (!row) {
    return {
      ok: false,
      error: "Peça um código novo e tente de novo.",
      status: 400,
    };
  }

  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await admin
      .from("client_whatsapp_otps")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", row.id);
    return {
      ok: false,
      error: "Código expirado. Peça um novo.",
      status: 400,
    };
  }

  if (row.attempts >= row.max_attempts) {
    await admin
      .from("client_whatsapp_otps")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", row.id);
    return {
      ok: false,
      error: "Muitas tentativas. Peça um código novo.",
      status: 429,
    };
  }

  const expectedHash = hashOtpCode(whatsapp, code);
  if (!codesMatch(expectedHash, row.code_hash)) {
    const nextAttempts = row.attempts + 1;
    await admin
      .from("client_whatsapp_otps")
      .update({
        attempts: nextAttempts,
        ...(nextAttempts >= row.max_attempts
          ? { consumed_at: new Date().toISOString() }
          : {}),
      })
      .eq("id", row.id);

    return {
      ok: false,
      error:
        nextAttempts >= row.max_attempts
          ? "Muitas tentativas. Peça um código novo."
          : "Código incorreto. Confira e tente de novo.",
      status: nextAttempts >= row.max_attempts ? 429 : 400,
    };
  }

  await admin
    .from("client_whatsapp_otps")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", row.id);

  return { ok: true, whatsapp };
}
