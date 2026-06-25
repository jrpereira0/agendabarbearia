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
