"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwner, type ActionResult } from "@/lib/require-owner";

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido.");

// ------------------------------------------------------------
// Horário da barbearia
// ------------------------------------------------------------
const businessDaySchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    active: z.boolean(),
    openTime: timeSchema,
    closeTime: timeSchema,
  })
  .refine((d) => !d.active || d.openTime < d.closeTime, {
    message: "O horário de abrir precisa ser antes do de fechar.",
  });

const SLOT_STEPS = [5, 10, 15, 20, 30, 45, 60] as const;

export async function saveBusinessHours(
  days: z.infer<typeof businessDaySchema>[],
  slotStepMinutes: number
): Promise<ActionResult> {
  const denied = await requireOwner();
  if (denied) return denied;

  const parsed = z.array(businessDaySchema).length(7).safeParse(days);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  if (!SLOT_STEPS.includes(slotStepMinutes as (typeof SLOT_STEPS)[number])) {
    return { ok: false, error: "Intervalo da agenda inválido." };
  }

  const admin = createAdminClient();

  const { error: settingsError } = await admin
    .from("shop_settings")
    .update({ slot_step_minutes: slotStepMinutes })
    .eq("id", 1);

  if (settingsError) {
    return { ok: false, error: `Erro ao salvar: ${settingsError.message}` };
  }

  for (const day of parsed.data) {
    const { error } = await admin
      .from("business_hours")
      .update({
        active: day.active,
        open_time: day.openTime,
        close_time: day.closeTime,
      })
      .eq("weekday", day.weekday);

    if (error) return { ok: false, error: `Erro ao salvar: ${error.message}` };
  }

  revalidatePath("/admin/horarios");
  return { ok: true };
}

// ------------------------------------------------------------
// Exceções por data
// ------------------------------------------------------------
const exceptionSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data."),
    professionalId: z.uuid().nullable(),
    kind: z.enum(["closed", "custom"]),
    startTime: timeSchema.nullable(),
    endTime: timeSchema.nullable(),
    note: z.string().trim().max(200),
  })
  .refine(
    (e) =>
      e.kind === "closed" ||
      (e.startTime && e.endTime && e.startTime < e.endTime),
    { message: "Informe um horário válido pro dia especial." }
  );

export async function createException(
  input: z.infer<typeof exceptionSchema>
): Promise<ActionResult> {
  const denied = await requireOwner();
  if (denied) return denied;

  const parsed = exceptionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("schedule_exceptions").insert({
    date: parsed.data.date,
    professional_id: parsed.data.professionalId,
    kind: parsed.data.kind,
    start_time: parsed.data.kind === "custom" ? parsed.data.startTime : null,
    end_time: parsed.data.kind === "custom" ? parsed.data.endTime : null,
    note: parsed.data.note,
  });

  if (error) return { ok: false, error: `Erro ao salvar: ${error.message}` };

  revalidatePath("/admin/horarios");
  return { ok: true };
}

export async function deleteException(id: string): Promise<ActionResult> {
  const denied = await requireOwner();
  if (denied) return denied;

  const admin = createAdminClient();
  const { error } = await admin
    .from("schedule_exceptions")
    .delete()
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/horarios");
  return { ok: true };
}
