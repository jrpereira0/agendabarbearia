export const WHATSAPP_INVALID_MESSAGE =
  "WhatsApp deve ter DDD + número (10 ou 11 dígitos).";

/** Remove tudo que não é dígito. */
export function digitsOnlyWhatsapp(input: string): string {
  return input.replace(/\D/g, "");
}

/**
 * Normaliza WhatsApp para busca/gravação consistente (código do Brasil 55).
 * Aceita entradas com máscara, espaços ou +55.
 * Retorna null se inválido.
 */
export function normalizeWhatsapp(input: string): string | null {
  const digits = digitsOnlyWhatsapp(input);
  if (!digits) return null;

  if (digits.startsWith("55")) {
    if (digits.length === 12 || digits.length === 13) return digits;
    return null;
  }

  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  return null;
}

/** Variantes para achar cadastros antigos com ou sem o prefixo 55. */
export function whatsappLookupKeys(canonical: string): string[] {
  const keys = [canonical];
  if (canonical.startsWith("55") && canonical.length >= 12) {
    keys.push(canonical.slice(2));
  }
  return [...new Set(keys)];
}

/** Valida e normaliza entrada (máscara, com ou sem 55). */
export function parseWhatsapp(raw: string): string | null {
  return normalizeWhatsapp(raw);
}

/** Número completo o bastante para buscar cadastro automaticamente. */
export function isWhatsappLookupReady(input: string): boolean {
  return normalizeWhatsapp(input) !== null;
}

/** Dois números são o mesmo WhatsApp (com ou sem 55 no banco). */
export function whatsappMatches(a: string, b: string): boolean {
  const left = normalizeWhatsapp(a);
  const right = normalizeWhatsapp(b);
  return left !== null && right !== null && left === right;
}

/** Debounce da busca automática: celular completo dispara na hora. */
export function whatsappLookupDelayMs(input: string): number | null {
  const normalized = normalizeWhatsapp(input);
  if (!normalized) return null;
  return normalized.length - 2 >= 11 ? 0 : 500;
}
