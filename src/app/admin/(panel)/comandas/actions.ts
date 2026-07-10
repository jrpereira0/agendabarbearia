"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  calculateComandaTotals,
  CASH_INFLOW_PAYMENT_METHODS,
  PAYMENT_METHODS,
  type ComandaDetail,
  type ComandaItemInput,
  type ComandaPaymentInput,
} from "@/lib/comanda-types";
import {
  closeComanda,
  getComandaForAppointment,
  getComandaById,
  reopenComanda,
  updateComandaItems,
  type CreditDepositInput,
} from "@/lib/comanda-service";
import { barberCanAccessComanda } from "@/lib/comanda-barber-access";
import {
  canCloseComandaInOpenCashRegister,
  getOpenCashRegisterSessionBasic,
} from "@/lib/cash-register-service";
import {
  addCustomerCredit,
  getCustomerCreditBalanceByWhatsapp,
} from "@/lib/customer-credit-service";
import { requireAdminClient, systemUnavailable } from "@/lib/supabase/admin";
import { isActionResult } from "@/lib/is-action-result";
import { requireAdmin } from "@/lib/require-admin";
import { requireOwner, type ActionResult } from "@/lib/require-owner";
import { assertPermission } from "@/lib/professional-permissions";

const itemSchema = z
  .object({
    id: z.uuid().optional(),
    serviceId: z.uuid().optional(),
    productId: z.uuid().optional(),
    serviceName: z.string().trim().min(1),
    catalogPriceCents: z.number().int().min(0),
    chargedPriceCents: z.number().int().min(0),
    quantity: z.number().int().min(1).optional(),
    commissionPercent: z.number().int().min(0).max(100).optional(),
    appointmentId: z.uuid().optional(),
    professionalId: z.uuid().optional(),
    startTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/, "Horário inválido.")
      .optional(),
    isComandaExtra: z.boolean().optional(),
    isTip: z.boolean().optional(),
  })
  .superRefine((item, ctx) => {
    if (item.isTip) {
      if (!item.professionalId) {
        ctx.addIssue({
          code: "custom",
          message: "Escolha o barbeiro da gorjeta.",
          path: ["professionalId"],
        });
      }
      return;
    }
    if (item.productId) {
      if (!item.professionalId) {
        ctx.addIssue({
          code: "custom",
          message: "Escolha o barbeiro que vendeu o produto.",
          path: ["professionalId"],
        });
      }
      return;
    }
    if (!item.serviceId) {
      ctx.addIssue({
        code: "custom",
        message: "Serviço inválido.",
        path: ["serviceId"],
      });
    }
  });

const paymentSchema = z.object({
  paymentMethod: z.enum(PAYMENT_METHODS),
  amountCents: z.number().int().positive(),
});

const creditDepositSchema = z.object({
  amountCents: z.number().int().positive(),
  paymentMethod: z.enum(CASH_INFLOW_PAYMENT_METHODS),
});

async function assertBarberComandaAccess(
  comandaId: string,
  session: Awaited<ReturnType<typeof requireAdmin>>
): Promise<ActionResult | null> {
  if (!("userId" in session) || session.isOwner) return null;

  const admin = requireAdminClient();
  if (isActionResult(admin)) return admin;

  const result = await getComandaById(admin, comandaId);
  if (!result.ok) return { ok: false, error: result.error };
  if (
    !session.professionalId ||
    !barberCanAccessComanda(result.comanda, session.professionalId)
  ) {
    return { ok: false, error: "Você não pode alterar esta comanda." };
  }

  return null;
}

export async function loadComandaForAppointment(
  appointmentId: string
): Promise<
  | {
      ok: true;
      comanda: ComandaDetail;
      isOwner: boolean;
      cashRegisterOpen: boolean;
      openCashRegisterDate: string | null;
      customerCreditBalanceCents: number;
    }
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

  const result = await getComandaForAppointment(admin, appointmentId);
  if (!result.ok) return { ok: false, error: result.error };

  const [openCashRegister, customerCreditBalanceCents] = await Promise.all([
    getOpenCashRegisterSessionBasic(admin),
    getCustomerCreditBalanceByWhatsapp(admin, result.comanda.customerWhatsapp),
  ]);

  if (!session.isOwner) {
    if (!session.professionalId) {
      return { ok: false, error: "Você não pode ver esta comanda." };
    }
    if (!session.permissions.canOpenComanda) {
      return { ok: false, error: "Você não pode abrir comandas." };
    }
    if (!barberCanAccessComanda(result.comanda, session.professionalId)) {
      return { ok: false, error: "Você não pode ver esta comanda." };
    }
  }

  return {
    ok: true,
    comanda: result.comanda,
    isOwner: session.isOwner,
    cashRegisterOpen: await canCloseComandaInOpenCashRegister(
      admin,
      result.comanda.serviceDate,
      openCashRegister
    ),
    openCashRegisterDate: openCashRegister?.serviceDate ?? null,
    customerCreditBalanceCents,
  };
}

export async function saveComandaItems(
  comandaId: string,
  items: ComandaItemInput[]
): Promise<
  { ok: true; comanda: ComandaDetail } | { ok: false; error: string }
> {
  const session = await requireAdmin();
  if (!("userId" in session)) {
    return { ok: false, error: "error" in session ? session.error : "Erro." };
  }

  const denied = assertPermission(session, "canEditComanda");
  if (denied && !denied.ok) return { ok: false, error: denied.error };

  const parsed = z.array(itemSchema).safeParse(items);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const serviceItems = parsed.data.filter((item) => !item.isTip);
  if (serviceItems.length === 0) {
    return { ok: false, error: "Informe ao menos um serviço na comanda." };
  }

  const admin = requireAdminClient();
  if (isActionResult(admin)) {
    return { ok: false, error: admin.error };
  }

  const accessDenied = await assertBarberComandaAccess(comandaId, session);
  if (accessDenied && !accessDenied.ok) {
    return { ok: false, error: accessDenied.error };
  }

  const result = await updateComandaItems(admin, comandaId, parsed.data);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/admin");
  return { ok: true, comanda: result.comanda };
}

export async function closeComandaWithItemsAction(
  comandaId: string,
  items: ComandaItemInput[],
  payments: ComandaPaymentInput[],
  options?: { creditDeposits?: CreditDepositInput[] }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireAdmin();
  if (!("userId" in session)) {
    return { ok: false, error: "error" in session ? session.error : "Erro." };
  }
  if (!session.isOwner) {
    const denied = assertPermission(session, "canCloseComanda");
    if (denied && !denied.ok) return { ok: false, error: denied.error };
  }

  const parsedItems = z.array(itemSchema).safeParse(items);
  if (!parsedItems.success) {
    return { ok: false, error: parsedItems.error.issues[0].message };
  }

  const serviceItems = parsedItems.data.filter((item) => !item.isTip);
  if (serviceItems.length === 0) {
    return { ok: false, error: "Informe ao menos um serviço na comanda." };
  }

  const parsedPayments = z.array(paymentSchema).min(1).safeParse(payments);
  if (!parsedPayments.success) {
    return { ok: false, error: parsedPayments.error.issues[0].message };
  }

  const parsedCreditDeposits = z
    .array(creditDepositSchema)
    .optional()
    .safeParse(options?.creditDeposits);
  if (!parsedCreditDeposits.success) {
    return { ok: false, error: parsedCreditDeposits.error.issues[0].message };
  }

  const admin = requireAdminClient();
  if (isActionResult(admin)) {
    return { ok: false, error: admin.error };
  }

  const accessDenied = await assertBarberComandaAccess(comandaId, session);
  if (accessDenied && !accessDenied.ok) {
    return { ok: false, error: accessDenied.error };
  }

  const itemsResult = await updateComandaItems(admin, comandaId, parsedItems.data);
  if (!itemsResult.ok) return { ok: false, error: itemsResult.error };

  const closeResult = await closeComanda(
    admin,
    comandaId,
    parsedPayments.data,
    session.userId,
    { creditDeposits: parsedCreditDeposits.data }
  );
  if (!closeResult.ok) return { ok: false, error: closeResult.error };

  revalidatePath("/admin");
  revalidatePath("/admin/financeiro");
  return { ok: true };
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
    const denied = assertPermission(session, "canCloseComanda");
    if (denied && !denied.ok) return { ok: false, error: denied.error };
  }

  const parsed = z.array(paymentSchema).min(1).safeParse(payments);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const admin = requireAdminClient();
  if (isActionResult(admin)) {
    return { ok: false, error: admin.error };
  }

  const accessDenied = await assertBarberComandaAccess(comandaId, session);
  if (accessDenied && !accessDenied.ok) {
    return { ok: false, error: accessDenied.error };
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
  revalidatePath("/admin/clientes");
  return { ok: true, comanda: result.comanda };
}

export async function previewComandaTotals(
  professionalId: string,
  items: Pick<ComandaItemInput, "chargedPriceCents">[]
): Promise<{ totalCents: number; commissionCents: number } | null> {
  const session = await requireAdmin();
  if (!("userId" in session)) return null;

  if (!session.isOwner && session.professionalId !== professionalId) {
    return null;
  }

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
