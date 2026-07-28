import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { safeApiRoute } from "@/lib/api/safe-route";
import { withProtectedApiRouteGuard } from "@/lib/api/with-api-guard";
import {
  getCustomerByWhatsapp,
  updateCustomerProfileByWhatsapp,
} from "@/lib/lookup-customer";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadPublicPhoto } from "@/lib/upload-photo";
import { normalizePhotoPosition } from "@/lib/photo-position";

const patchBodySchema = z.object({
  firstName: z.string().trim().min(1, "Informe o nome."),
  lastName: z.string().trim().optional().default(""),
});

function requireClientWhatsapp(auth: { type: string; whatsapp?: string }) {
  if (auth.type !== "client" || !auth.whatsapp) {
    return null;
  }
  return auth.whatsapp;
}

/**
 * GET /api/v1/customers/me
 * Perfil do cliente autenticado (Bearer OTP / cookie de sessão).
 */
export async function GET(request: NextRequest) {
  return safeApiRoute(async () => {
    return withProtectedApiRouteGuard(
      request,
      { scope: "customers:read", rateLimit: "whatsappSensitive" },
      async ({ auth }) => {
        const whatsapp = requireClientWhatsapp(auth);
        if (!whatsapp) {
          return NextResponse.json(
            {
              ok: false,
              error: "Confirme o WhatsApp pra acessar seus dados.",
            },
            { status: 403 }
          );
        }

        const result = await getCustomerByWhatsapp(whatsapp);
        if (!result.ok) {
          return NextResponse.json(
            { ok: false, error: result.error },
            { status: result.httpStatus }
          );
        }

        return NextResponse.json({
          ok: true,
          found: result.found,
          customer: result.customer,
        });
      }
    );
  });
}

async function parsePatchInput(request: NextRequest): Promise<
  | {
      ok: true;
      firstName: string;
      lastName: string;
      photo: File | null;
      photoPosition: string | null;
    }
  | { ok: false; error: string; status: number }
> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return { ok: false, error: "Corpo da requisição inválido.", status: 400 };
    }

    const firstName = String(form.get("firstName") ?? "").trim();
    const lastName = String(form.get("lastName") ?? "").trim();
    if (!firstName) {
      return { ok: false, error: "Informe o nome.", status: 400 };
    }

    const photoRaw = form.get("photo");
    const photo =
      photoRaw instanceof File && photoRaw.size > 0 ? photoRaw : null;
    const positionRaw = form.get("photoPosition");
    const photoPosition =
      typeof positionRaw === "string" && positionRaw.trim()
        ? normalizePhotoPosition(positionRaw)
        : null;

    return { ok: true, firstName, lastName, photo, photoPosition };
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return { ok: false, error: "Corpo da requisição inválido.", status: 400 };
  }

  const parsed = patchBodySchema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
      status: 400,
    };
  }

  return {
    ok: true,
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    photo: null,
    photoPosition: null,
  };
}

/**
 * PATCH /api/v1/customers/me
 * Atualiza nome, sobrenome e foto do cliente autenticado.
 * Aceita JSON ou multipart (com foto). WhatsApp não muda.
 */
export async function PATCH(request: NextRequest) {
  return safeApiRoute(async () => {
    const parsed = await parsePatchInput(request);
    if (!parsed.ok) {
      return NextResponse.json(
        { ok: false, error: parsed.error },
        { status: parsed.status }
      );
    }

    return withProtectedApiRouteGuard(
      request,
      { scope: "customers:update", rateLimit: "whatsappSensitive" },
      async ({ auth }) => {
        const whatsapp = requireClientWhatsapp(auth);
        if (!whatsapp) {
          return NextResponse.json(
            {
              ok: false,
              error: "Confirme o WhatsApp pra acessar seus dados.",
            },
            { status: 403 }
          );
        }

        let photoUrl: string | undefined;
        const photoPosition = parsed.photoPosition;

        if (parsed.photo) {
          const admin = createAdminClient();
          if (!admin) {
            return NextResponse.json(
              { ok: false, error: "Sistema indisponível no momento." },
              { status: 503 }
            );
          }

          // Garante o registro (ou atualiza nome) antes do upload, pra ter id estável.
          const base = await updateCustomerProfileByWhatsapp({
            whatsapp,
            firstName: parsed.firstName,
            lastName: parsed.lastName,
            photoPosition: photoPosition ?? undefined,
          });
          if (!base.ok) {
            return NextResponse.json(
              { ok: false, error: base.error },
              { status: base.httpStatus }
            );
          }

          const uploaded = await uploadPublicPhoto(
            admin,
            "customers",
            base.customer.id,
            parsed.photo
          );
          if (!uploaded.ok) {
            return NextResponse.json(
              { ok: false, error: uploaded.error },
              { status: 400 }
            );
          }

          photoUrl = uploaded.url;
          const withPhoto = await updateCustomerProfileByWhatsapp({
            whatsapp,
            firstName: parsed.firstName,
            lastName: parsed.lastName,
            photoUrl,
            photoPosition: photoPosition ?? undefined,
          });
          if (!withPhoto.ok) {
            return NextResponse.json(
              { ok: false, error: withPhoto.error },
              { status: withPhoto.httpStatus }
            );
          }

          return NextResponse.json({
            ok: true,
            customer: withPhoto.customer,
          });
        }

        const result = await updateCustomerProfileByWhatsapp({
          whatsapp,
          firstName: parsed.firstName,
          lastName: parsed.lastName,
          photoPosition: photoPosition ?? undefined,
        });

        if (!result.ok) {
          return NextResponse.json(
            { ok: false, error: result.error },
            { status: result.httpStatus }
          );
        }

        return NextResponse.json({
          ok: true,
          customer: result.customer,
        });
      }
    );
  });
}
