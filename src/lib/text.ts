// Normaliza texto pra busca: minúsculas e sem acentos.
// "Degradê" -> "degrade"
export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Verifica se o texto contém o termo buscado, ignorando acentos e maiúsculas.
export function matchesSearch(haystack: string, query: string): boolean {
  return normalizeText(haystack).includes(normalizeText(query.trim()));
}
