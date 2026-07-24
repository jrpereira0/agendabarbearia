const LOG_PREFIX = "[expo-push]";
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  channelId?: string;
};

type ExpoTicket = {
  status?: string;
  id?: string;
  message?: string;
  details?: { error?: string };
};

/**
 * Envia push via Expo Push API. Nunca lança.
 * Remove tokens inválidos via callback opcional.
 */
export async function sendExpoPushNotifications(
  messages: ExpoPushMessage[],
  options?: {
    onInvalidToken?: (token: string) => Promise<void> | void;
  }
): Promise<{ sent: number; failed: number }> {
  if (messages.length === 0) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;

  // Expo recomenda lotes de até 100.
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chunk),
      });

      const body = (await response.json().catch(() => null)) as {
        data?: ExpoTicket | ExpoTicket[];
      } | null;

      if (!response.ok) {
        console.warn(`${LOG_PREFIX} HTTP ${response.status}`, body);
        failed += chunk.length;
        continue;
      }

      const tickets = Array.isArray(body?.data)
        ? body.data
        : body?.data
          ? [body.data]
          : [];

      for (let index = 0; index < chunk.length; index++) {
        const ticket = tickets[index];
        if (ticket?.status === "ok") {
          sent += 1;
          continue;
        }
        failed += 1;
        const err = ticket?.details?.error ?? ticket?.message;
        console.warn(`${LOG_PREFIX} ticket falhou`, {
          to: chunk[index]?.to,
          err,
        });
        if (
          (err === "DeviceNotRegistered" || err === "InvalidCredentials") &&
          options?.onInvalidToken
        ) {
          await options.onInvalidToken(chunk[index].to);
        }
      }
    } catch (error) {
      console.error(`${LOG_PREFIX} erro de rede`, error);
      failed += chunk.length;
    }
  }

  return { sent, failed };
}
