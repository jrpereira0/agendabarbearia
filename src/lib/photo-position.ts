/** Valor padrão de object-position (centro). */
export const DEFAULT_PHOTO_POSITION = "50% 50%";

const POSITION_RE = /^(\d{1,3})%\s+(\d{1,3})%$/;

export function parsePhotoPosition(value: string | null | undefined): {
  x: number;
  y: number;
} {
  if (!value) return { x: 50, y: 50 };
  const match = value.trim().match(POSITION_RE);
  if (!match) return { x: 50, y: 50 };
  const x = Math.min(100, Math.max(0, Number(match[1])));
  const y = Math.min(100, Math.max(0, Number(match[2])));
  return { x, y };
}

export function formatPhotoPosition(x: number, y: number): string {
  const nx = Math.round(Math.min(100, Math.max(0, x)));
  const ny = Math.round(Math.min(100, Math.max(0, y)));
  return `${nx}% ${ny}%`;
}

export function normalizePhotoPosition(
  value: string | null | undefined
): string {
  const { x, y } = parsePhotoPosition(value);
  return formatPhotoPosition(x, y);
}
