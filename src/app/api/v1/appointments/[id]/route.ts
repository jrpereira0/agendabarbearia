import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  cancelPublicAppointment,
  updatePublicAppointment,
} from "@/lib/manage-public-appointment";

const whatsappQuerySchema = z.object({
  whatsapp: z
    .string()
    .regex(/^\d{10,13}$/, "WhatsApp deve ter de 10 a 13 números."),
});

const updateBodySchema = z.object({
  whatsapp: z
    .string()
    .regex(/^\d{10,13}$/, "WhatsApp deve ter de 10 a 13 números."),
  professionalId: z.uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  serviceIds: z.array(z.uuid()).min(1),
});

type RouteContext = { params: Promise<{ id: string }> };

// PATCH /api/v1/appointments/:id — remarcar agendamento do cliente
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const parsed = updateBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const result = await updatePublicAppointment(id, parsed.data);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  revalidatePath("/admin");
  revalidatePath("/agenda");
  return NextResponse.json({ ok: true, appointmentId: result.data.id });
}

// DELETE /api/v1/appointments/:id?whatsapp=... — cancelar agendamento do cliente
export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const whatsapp = request.nextUrl.searchParams.get("whatsapp") ?? "";

  const parsed = whatsappQuerySchema.safeParse({ whatsapp });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const result = await cancelPublicAppointment(id, parsed.data.whatsapp);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  revalidatePath("/admin");
  revalidatePath("/agenda");
  return NextResponse.json({ ok: true, appointmentId: result.data.id });
}
