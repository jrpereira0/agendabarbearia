import { createAdminClient } from "@/lib/supabase/admin";
import {
  listDueAppointmentReminders,
  markAppointmentReminderSent,
  REMINDER_TYPE_ONE_HOUR,
  REMINDER_TYPE_THIRTY_MINUTES,
  type AppointmentReminderPayload,
} from "@/lib/appointment-reminders";
import {
  deleteCustomerPushToken,
  listExpoPushTokensForWhatsapp,
} from "@/lib/customer-push-tokens";
import { sendExpoPushNotifications } from "@/lib/expo-push";
import { formatDateBR, formatTime } from "@/lib/format";

const LOG_PREFIX = "[push-reminders]";

function reminderCopy(reminder: AppointmentReminderPayload): {
  title: string;
  body: string;
} {
  const when = `${formatDateBR(reminder.appointment.date)} às ${formatTime(reminder.appointment.startTime)}`;
  const pro = reminder.professional.name;
  const shop = reminder.shop.name;

  if (reminder.reminderType === REMINDER_TYPE_THIRTY_MINUTES) {
    return {
      title: "Lembrete · 30 minutos",
      body: `Seu horário na ${shop} é daqui a 30 min (${when} com ${pro}).`,
    };
  }

  return {
    title: "Lembrete · 1 hora",
    body: `Seu horário na ${shop} é daqui a 1 hora (${when} com ${pro}).`,
  };
}

/**
 * Processa lembretes vencidos e envia push no app (sem n8n).
 */
export async function processDueAppointmentReminderPushes(options?: {
  limit?: number;
  now?: Date;
}): Promise<{ processed: number; sent: number; failed: number }> {
  const due = await listDueAppointmentReminders(options);
  let processed = 0;
  let sent = 0;
  let failed = 0;

  for (const reminder of due) {
    processed += 1;
    const tokens = await listExpoPushTokensForWhatsapp(reminder.customer.whatsapp);
    if (tokens.length === 0) {
      console.log(`${LOG_PREFIX} sem token, marcando enviado`, {
        reminderId: reminder.id,
        reminderType: reminder.reminderType,
      });
      // Sem aparelho registrado: marca como enviado pra não ficar reprocessando.
      await markAppointmentReminderSent(reminder.id);
      continue;
    }

    const copy = reminderCopy(reminder);
    const result = await sendExpoPushNotifications(
      tokens.map((to) => ({
        to,
        title: copy.title,
        body: copy.body,
        sound: "default",
        channelId: "appointments",
        data: {
          type: "appointment_reminder",
          reminderType: reminder.reminderType,
          appointmentId: reminder.appointmentId,
          reminderId: reminder.id,
        },
      })),
      {
        onInvalidToken: async (token) => {
          await deleteCustomerPushToken({
            whatsapp: reminder.customer.whatsapp,
            expoPushToken: token,
          });
        },
      }
    );

    sent += result.sent;
    failed += result.failed;

    if (result.sent > 0 || tokens.length > 0) {
      await markAppointmentReminderSent(reminder.id);
    }
  }

  console.log(`${LOG_PREFIX} ciclo`, { processed, sent, failed });
  return { processed, sent, failed };
}

export async function sendClientAppointmentPush(input: {
  whatsapp: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}): Promise<void> {
  const tokens = await listExpoPushTokensForWhatsapp(input.whatsapp);
  if (tokens.length === 0) {
    console.log(`${LOG_PREFIX} sem token para aviso`, {
      whatsapp: input.whatsapp,
    });
    return;
  }

  await sendExpoPushNotifications(
    tokens.map((to) => ({
      to,
      title: input.title,
      body: input.body,
      sound: "default",
      channelId: "appointments",
      data: input.data,
    })),
    {
      onInvalidToken: async (token) => {
        await deleteCustomerPushToken({
          whatsapp: input.whatsapp,
          expoPushToken: token,
        });
      },
    }
  );
}

/** Remove tokens órfãos (service role). */
export async function purgePushToken(token: string): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  await admin.from("customer_push_tokens").delete().eq("expo_push_token", token);
}
