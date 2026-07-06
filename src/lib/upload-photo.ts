import type { SupabaseClient } from "@supabase/supabase-js";

// O navegador já comprime fotos antes de enviar (compress-image.ts);
// esse limite é só uma trava de segurança contra uploads fora do fluxo normal.
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

type ImageSignature = {
  ext: string;
  mime: string;
  matches: (bytes: Uint8Array) => boolean;
};

// Não confiamos na extensão do nome do arquivo nem no `photo.type` enviados
// pelo navegador — conferimos os primeiros bytes do arquivo (magic numbers)
// para garantir que é mesmo uma imagem antes de salvar no storage público.
const IMAGE_SIGNATURES: ImageSignature[] = [
  {
    ext: "jpg",
    mime: "image/jpeg",
    matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    ext: "png",
    mime: "image/png",
    matches: (b) =>
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  },
  {
    ext: "webp",
    mime: "image/webp",
    matches: (b) =>
      b[0] === 0x52 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x46 &&
      b[8] === 0x57 &&
      b[9] === 0x45 &&
      b[10] === 0x42 &&
      b[11] === 0x50,
  },
  {
    ext: "gif",
    mime: "image/gif",
    matches: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46,
  },
];

export type UploadPhotoResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

export async function uploadPublicPhoto(
  admin: SupabaseClient,
  folder: string,
  baseName: string,
  photo: File
): Promise<UploadPhotoResult> {
  if (photo.size === 0) {
    return { ok: false, error: "Arquivo vazio." };
  }
  if (photo.size > MAX_PHOTO_BYTES) {
    return { ok: false, error: "Imagem muito grande (máximo 8MB)." };
  }

  const buffer = await photo.arrayBuffer();
  const head = new Uint8Array(buffer.slice(0, 12));
  const signature = IMAGE_SIGNATURES.find((s) => s.matches(head));

  if (!signature) {
    return {
      ok: false,
      error: "Envie uma imagem JPG, PNG, WEBP ou GIF.",
    };
  }

  const path = `${folder}/${baseName}-${Date.now()}.${signature.ext}`;

  const { error } = await admin.storage.from("photos").upload(path, buffer, {
    contentType: signature.mime,
    upsert: true,
  });

  if (error) {
    return { ok: false, error: "Não foi possível enviar a foto." };
  }

  return {
    ok: true,
    url: admin.storage.from("photos").getPublicUrl(path).data.publicUrl,
  };
}
