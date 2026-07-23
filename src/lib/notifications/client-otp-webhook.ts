const LOG_PREFIX = "[client-otp-webhook]";

export type ClientOtpWebhookPayload = {
  event: "client.otp";
  whatsapp: string;
  code: string;
  expiresInMinutes: number;
  shop: { name: string };
  message: string;
};

/**
 * Envia o código OTP ao n8n para disparar no WhatsApp do cliente.
 * Nunca lança: falha só em log (quem chamou decide se bloqueia o fluxo).
 */
export async function sendClientOtpWebhook(
  payload: ClientOtpWebhookPayload
): Promise<{ ok: true } | { ok: false; error: string }> {
  const webhookUrl = process.env.N8N_CLIENT_OTP_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    console.warn(
      `${LOG_PREFIX} N8N_CLIENT_OTP_WEBHOOK_URL não configurada`,
      { whatsapp: payload.whatsapp }
    );
    if (process.env.NODE_ENV !== "production") {
      console.info(`${LOG_PREFIX} [dev] código OTP`, {
        whatsapp: payload.whatsapp,
        code: payload.code,
      });
      return { ok: true };
    }
    return {
      ok: false,
      error:
        "Envio de código ainda não está configurado. Tente de novo em instantes.",
    };
  }

  try {
    const secret = process.env.N8N_CLIENT_OTP_WEBHOOK_SECRET?.trim();
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { "x-client-otp-webhook-secret": secret } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const responseText = await response.text();
      console.warn(`${LOG_PREFIX} n8n respondeu ${response.status}`, {
        whatsapp: payload.whatsapp,
        body: responseText.slice(0, 500),
      });
      return {
        ok: false,
        error: "Não foi possível enviar o código no WhatsApp. Tente de novo.",
      };
    }

    return { ok: true };
  } catch (error) {
    console.error(`${LOG_PREFIX} erro ao enviar webhook`, {
      whatsapp: payload.whatsapp,
      error,
    });
    return {
      ok: false,
      error: "Não foi possível enviar o código no WhatsApp. Tente de novo.",
    };
  }
}
