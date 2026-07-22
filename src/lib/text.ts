// Normaliza texto pra busca: minúsculas e sem acentos.
// "Degradê" -> "degrade"
export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Nome de pessoa com a primeira letra de cada palavra maiúscula.
 * "ailton" -> "Ailton", "maria da silva" -> "Maria Da Silva"
 */
export function capitalizePersonName(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";

  return trimmed
    .split(" ")
    .map((word) =>
      word
        .split("-")
        .map((part) => {
          if (!part) return part;
          const lower = part.toLocaleLowerCase("pt-BR");
          return (
            lower.charAt(0).toLocaleUpperCase("pt-BR") + lower.slice(1)
          );
        })
        .join("-")
    )
    .join(" ");
}

// Compara nomes em ordem alfabética (pt-BR, ignora acentos e maiúsculas).
export function compareAlphabetically(a: string, b: string): number {
  return normalizeText(a).localeCompare(normalizeText(b));
}

// Verifica se o texto contém o termo buscado, ignorando acentos e maiúsculas.
export function matchesSearch(haystack: string, query: string): boolean {
  return normalizeText(haystack).includes(normalizeText(query.trim()));
}

/**
 * Busca de cliente no painel: nome (com ou sem acento) OU WhatsApp
 * (aceita últimos dígitos, número parcial ou com máscara).
 */
export function matchesCustomerSearch(
  customer: { firstName: string; lastName: string; whatsapp: string },
  query: string
): boolean {
  const q = query.trim();
  if (!q) return true;

  const fullName = `${customer.firstName} ${customer.lastName}`;
  if (matchesSearch(fullName, q)) return true;
  if (matchesSearch(customer.firstName, q)) return true;
  if (matchesSearch(customer.lastName, q)) return true;

  const queryDigits = q.replace(/\D/g, "");
  if (queryDigits.length >= 2) {
    const phoneDigits = customer.whatsapp.replace(/\D/g, "");
    if (
      phoneDigits.includes(queryDigits) ||
      phoneDigits.endsWith(queryDigits)
    ) {
      return true;
    }
  }

  return false;
}
