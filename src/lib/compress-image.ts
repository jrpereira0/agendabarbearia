// Comprime a imagem no navegador antes do envio: redimensiona para no
// máximo 1024px e converte pra WebP. Se algo falhar (formato exótico,
// navegador antigo), envia o arquivo original sem quebrar o fluxo.
export async function compressImage(
  file: File,
  maxSize = 1024,
  quality = 0.82
): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);

    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", quality)
    );

    // Só usa o resultado se realmente ficou menor que o original
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.\w+$/, "") + ".webp";
    return new File([blob], name, { type: "image/webp" });
  } catch {
    return file;
  }
}
