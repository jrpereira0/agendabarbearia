import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { lookupCustomerByWhatsapp } from "@/lib/lookup-customer";
import { enforcePublicApiRateLimit } from "@/lib/rate-limit";

const querySchema = z.object({
  whatsapp: z
    .string()
    .regex(/^\d{10,13}$/, "WhatsApp deve ter de 10 a 13 números."),
});

// GET /api/v1/customers/lookup?whatsapp=... — busca cliente pelo WhatsApp (agendamento online)
export async function GET(request: NextRequest) {
  const limited = enforcePublicApiRateLimit(request, "whatsappSensitive");
  if (limited) return limited;

  const whatsapp = request.nextUrl.searchParams.get("whatsapp") ?? "";

  const parsed = querySchema.safeParse({ whatsapp });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const result = await lookupCustomerByWhatsapp(parsed.data.whatsapp);
  return NextResponse.json(result);
}
