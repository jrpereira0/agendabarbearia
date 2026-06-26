"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  calculateComandaTotals,
  PAYMENT_METHODS,
  type ComandaDetail,
  type ComandaItemInput,
  type ComandaPaymentInput,
} from "@/lib/comanda-types";
import {
  closeComanda,
  getOrCreateComandaForAppointment,
  reopenComanda,
  updateComandaItems,
} from "@/lib/comanda-service";
import { requireAdminClient, systemUnavailable } from "@/lib/supabase/admin";
import { isActionResult } from "@/lib/is-action-result";
import { requireAdmin } from "@/lib/require-admin";
import { requireOwner, type ActionResult } from "@/lib/require-owner";

const itemSchema = z.object({
  id: z.uuid().optional(),
  serviceId: z.uuid(),
  serviceName: z.string().trim().min(1),
  catalogPriceCents: z.number().int().min(0),
  chargedPriceCents: z.number().int().min(0),
  appointmentId: z.uuid().optional(),
  professionalId: z.uuid().optional(),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Horário inválido.")
    .optional(),
  isComandaExtra: z.boolean().optional(),
});

const paymentSchema = z.object({
  paymentMethod: z.enum(PAYMENT_METHODS),
  amountCents: z.number().int().positive(),
});

export async function loadComandaForAppointment(
  appointmentId: string
): Promise<
  | { ok: true; comanda: ComandaDetail; isOwner: boolean }
  | { ok: false; error: string }
> {
  const session = await requireAdmin();
  if (!("userId" in session)) {
    return { ok: false, error: "error" in session ? session.error : "Erro." };
  }

  const admin = requireAdminClient();
  if (isActionResult(admin)) {
    return { ok: false, error: admin.error };
  }

  const result = await getOrCreateComandaForAppointment(admin, appointmentId);
  if (!result.ok) return { ok: false, error: result.error };

  if (!session.isOwner) {
    const canAccess =
      result.comanda.linkedAppointments.some(
        (apt) => apt.professionalId === session.professionalId
      ) ||
      result.comanda.items.some(
        (item) => item.professionalId === session.professionalId
      ) ||
      result.comanda.professionalId === session.professionalId;

    if (!canAccess) {
      return { ok: false, error: "Você não pode ver esta comanda." };
    }
  }

  return {
    ok: true,
    comanda: result.comanda,
    isOwner: session.isOwner,
  };
}

export async function saveComandaItems(
  comandaId: string,
  items: ComandaItemInput[]
): Promise<
  { ok: true; comanda: ComandaDetail } | { ok: false; error: string }
> {
  const denied = await requireOwner();
  if (denied !== null) {
    return denied.ok === false
      ? { ok: false, error: denied.error }
      : { ok: false, error: "Sem permissão." };
  }

  const parsed = z.array(itemSchema).min(1).safeParse(items);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const admin = requireAdminClient();
  if (isActionResult(admin)) {
    return { ok: false, error: admin.error };
  }

  const result = await updateComandaItems(admin, comandaId, parsed.data);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/admin");
  revalidatePath("/admin/financeiro");
  return { ok: true, comanda: result.comanda };
}

export async function closeComandaAction(
  comandaId: string,
  payments: ComandaPaymentInput[]
): Promise<
  { ok: true; comanda: ComandaDetail } | { ok: false; error: string }
> {
  const session = await requireAdmin();
  if (!("userId" in session)) {
    return { ok: false, error: "error" in session ? session.error : "Erro." };
  }
  if (!session.isOwner) {
    return { ok: false, error: "Apenas o dono pode fechar comandas." };
  }

  const parsed = z.array(paymentSchema).min(1).safeParse(payments);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const admin = requireAdminClient();
  if (isActionResult(admin)) {
    return { ok: false, error: admin.error };
  }

  const result = await closeComanda(
    admin,
    comandaId,
    parsed.data,
    session.userId
  );
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/admin");
  revalidatePath("/admin/financeiro");
  return { ok: true, comanda: result.comanda };
}

export async function reopenComandaAction(
  comandaId: string
): Promise<
  { ok: true; comanda: ComandaDetail } | { ok: false; error: string }
> {
  const denied = await requireOwner();
  if (denied !== null) {
    return denied.ok === false
      ? { ok: false, error: denied.error }
      : { ok: false, error: "Sem permissão." };
  }

  const admin = requireAdminClient();
  if (isActionResult(admin)) {
    return { ok: false, error: admin.error };
  }

  const result = await reopenComanda(admin, comandaId);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/admin");
  revalidatePath("/admin/financeiro");
  return { ok: true, comanda: result.comanda };
}

export async function previewComandaTotals(
  professionalId: string,
  items: Pick<ComandaItemInput, "chargedPriceCents">[]
): Promise<{ totalCents: number; commissionCents: number } | null> {
  const admin = requireAdminClient();
  if (isActionResult(admin)) return null;

  const { data } = await admin
    .from("professionals")
    .select("commission_percent")
    .eq("id", professionalId)
    .maybeSingle();

  return calculateComandaTotals(items, data?.commission_percent ?? 50);
}

export { systemUnavailable };
