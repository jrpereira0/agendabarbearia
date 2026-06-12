"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient, requireAdminClient, systemUnavailable } from "@/lib/supabase/admin";
import { isActionResult } from "@/lib/is-action-result";
import { requireOwner, type ActionResult } from "@/lib/require-owner";

const serviceSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do serviço."),
  description: z.string().trim(),
  priceCents: z
    .number()
    .int()
    .min(1, "Informe o preço do serviço."),
  durationMinutes: z
    .number()
    .int()
    .min(5, "A duração mínima é de 5 minutos.")
    .max(480, "A duração máxima é de 8 horas."),
  professionalIds: z.array(z.uuid()).default([]),
});

function parseForm(formData: FormData) {
  return serviceSchema.safeParse({
    name: formData.get("name"),
    description: String(formData.get("description") ?? ""),
    priceCents: Number(formData.get("priceCents") ?? 0),
    durationMinutes: Number(formData.get("durationMinutes") ?? 0),
    professionalIds: formData.getAll("professionalIds").map(String),
  });
}

async function syncProfessionals(serviceId: string, professionalIds: string[]) {
  const admin = createAdminClient();
  if (!admin) return;
  await admin
    .from("professional_services")
    .delete()
    .eq("service_id", serviceId);

  if (professionalIds.length > 0) {
    await admin.from("professional_services").insert(
      professionalIds.map((professionalId) => ({
        professional_id: professionalId,
        service_id: serviceId,
      }))
    );
  }
}

async function uploadPhoto(serviceId: string, photo: File): Promise<string | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const ext = photo.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `services/${serviceId}-${Date.now()}.${ext}`;

  const { error } = await admin.storage
    .from("photos")
    .upload(path, await photo.arrayBuffer(), {
      contentType: photo.type || "image/jpeg",
      upsert: true,
    });

  if (error) return null;
  return admin.storage.from("photos").getPublicUrl(path).data.publicUrl;
}

export async function createService(formData: FormData): Promise<ActionResult> {
  const denied = await requireOwner();
  if (denied) return denied;

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const admin = requireAdminClient();
  if (isActionResult(admin)) return admin;
  const { data: service, error } = await admin
    .from("services")
    .insert({
      name: parsed.data.name,
      description: parsed.data.description,
      price_cents: parsed.data.priceCents,
      duration_minutes: parsed.data.durationMinutes,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: `Erro ao salvar: ${error.message}` };

  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    const url = await uploadPhoto(service.id, photo);
    if (url) {
      await admin.from("services").update({ photo_url: url }).eq("id", service.id);
    }
  }

  await syncProfessionals(service.id, parsed.data.professionalIds);

  revalidatePath("/admin/servicos");
  return { ok: true };
}

export async function updateService(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const denied = await requireOwner();
  if (denied) return denied;

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const admin = requireAdminClient();
  if (isActionResult(admin)) return admin;

  const updates: Record<string, unknown> = {
    name: parsed.data.name,
    description: parsed.data.description,
    price_cents: parsed.data.priceCents,
    duration_minutes: parsed.data.durationMinutes,
  };

  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    const url = await uploadPhoto(id, photo);
    if (url) updates.photo_url = url;
  }

  const { error } = await admin.from("services").update(updates).eq("id", id);
  if (error) return { ok: false, error: `Erro ao salvar: ${error.message}` };

  await syncProfessionals(id, parsed.data.professionalIds);

  revalidatePath("/admin/servicos");
  return { ok: true };
}

export async function setServiceActive(
  id: string,
  active: boolean
): Promise<ActionResult> {
  const denied = await requireOwner();
  if (denied) return denied;

  const admin = requireAdminClient();
  if (isActionResult(admin)) return admin;
  const { error } = await admin.from("services").update({ active }).eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/servicos");
  return { ok: true };
}

export async function deleteService(id: string): Promise<ActionResult> {
  const denied = await requireOwner();
  if (denied) return denied;

  const admin = requireAdminClient();
  if (isActionResult(admin)) return admin;

  const { count } = await admin
    .from("appointment_services")
    .select("appointment_id", { count: "exact", head: true })
    .eq("service_id", id);

  if (count && count > 0) {
    return {
      ok: false,
      error:
        "Esse serviço já foi usado em agendamentos. Desative-o em vez de excluir.",
    };
  }

  const { error } = await admin.from("services").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/servicos");
  return { ok: true };
}
