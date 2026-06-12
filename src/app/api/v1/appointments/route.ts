import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createPublicAppointment } from "@/lib/create-public-appointment";
import { listPublicAppointmentsByWhatsapp } from "@/lib/manage-public-appointment";

const whatsappQuerySchema = z.object({
  whatsapp: z
    .string()
    .regex(/^\d{10,13}$/, "WhatsApp deve ter de 10 a 13 números."),
});

const bodySchema = z.object({
  professionalId: z.uuid("professionalId inválido."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date deve ser AAAA-MM-DD."),
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "startTime inválido."),
  serviceIds: z
    .array(z.uuid("serviceIds contém um id inválido."))
    .min(1, "Informe ao menos um serviço."),
  firstName: z.string().trim().min(1, "Informe o nome."),
  lastName: z.string().trim().min(1, "Informe o sobrenome."),
  whatsapp: z
    .string()
    .regex(/^\d{10,13}$/, "WhatsApp deve ter de 10 a 13 números."),
});

// GET /api/v1/appointments?whatsapp=... — agendamentos futuros do cliente
export async function GET(request: NextRequest) {
  const whatsapp = request.nextUrl.searchParams.get("whatsapp") ?? "";

  const parsed = whatsappQuerySchema.safeParse({ whatsapp });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const result = await listPublicAppointmentsByWhatsapp(parsed.data.whatsapp);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ appointments: result.data });
}

// POST /api/v1/appointments — agendamento online pelo cliente
export async function POST(request: NextRequest) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const result = await createPublicAppointment(parsed.data);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  revalidatePath("/admin");
  revalidatePath("/agenda");
  return NextResponse.json({ ok: true, appointmentId: result.appointmentId });
}
