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

export type CustomerSearchFields = {
  firstName: string;
  lastName: string;
  whatsapp: string;
};

const MIN_NAME_CHARS = 2;
const MIN_PHONE_DIGITS = 3;

/** Tokens de nome (sem acento) e dígitos de telefone da busca. */
export function parseCustomerSearchQuery(query: string): {
  tokens: string[];
  digits: string;
  isPhoneHeavy: boolean;
} {
  const q = query.trim();
  const digits = q.replace(/\D/g, "");
  const hasLetters = /[a-zA-ZÀ-ÿ]/.test(q);
  const tokens = normalizeText(q)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/\d/g, ""))
    .filter((t) => t.length >= 1);

  return {
    tokens,
    digits,
    // Só número: busca por WhatsApp (mín. 3 dígitos).
    isPhoneHeavy: digits.length >= MIN_PHONE_DIGITS && !hasLetters,
  };
}

/** Pronto para buscar? 2 letras no nome ou 3 dígitos no telefone. */
export function canRunCustomerSearch(query: string): boolean {
  const q = query.trim();
  if (!q) return false;

  const { tokens, digits } = parseCustomerSearchQuery(q);
  if (!/[a-zA-ZÀ-ÿ]/.test(q) && digits.length > 0) {
    return digits.length >= MIN_PHONE_DIGITS;
  }

  const nameChars = tokens.join("").length;
  if (nameChars >= MIN_NAME_CHARS) return true;
  if (digits.length >= MIN_PHONE_DIGITS) return true;
  return false;
}

/**
 * Busca de cliente no painel: nome (com ou sem acento, um ou mais
 * pedaços) OU WhatsApp (3+ dígitos em qualquer posição).
 */
export function matchesCustomerSearch(
  customer: CustomerSearchFields,
  query: string
): boolean {
  const q = query.trim();
  if (!q) return true;
  // Ainda digitando (1 letra / 2 dígitos): não esconde resultados da lista.
  if (!canRunCustomerSearch(q)) return true;

  const { tokens, digits, isPhoneHeavy } = parseCustomerSearchQuery(q);
  const fullName = normalizeText(
    `${customer.firstName} ${customer.lastName}`.trim()
  );
  const phoneDigits = customer.whatsapp.replace(/\D/g, "");

  if (digits.length >= MIN_PHONE_DIGITS) {
    // Começo, meio ou fim do número.
    if (phoneDigits.includes(digits)) return true;
    if (isPhoneHeavy) return false;
  }

  if (tokens.length === 0) return false;

  // Sem acento: "jose" encontra "José"; "joao silva" / "silva joao".
  if (tokens.every((token) => fullName.includes(token))) return true;

  return false;
}

/**
 * Quanto menor o número, mais relevante. Usado para ordenar sugestões.
 */
export function rankCustomerSearch(
  customer: CustomerSearchFields,
  query: string
): number {
  const q = query.trim();
  if (!q) return 100;

  const { tokens, digits, isPhoneHeavy } = parseCustomerSearchQuery(q);
  const fullName = normalizeText(
    `${customer.firstName} ${customer.lastName}`.trim()
  );
  const first = normalizeText(customer.firstName);
  const last = normalizeText(customer.lastName);
  const phoneDigits = customer.whatsapp.replace(/\D/g, "");
  const qNorm = normalizeText(q);

  if (digits.length >= MIN_PHONE_DIGITS && phoneDigits.length > 0) {
    if (phoneDigits === digits) return 0;
    if (phoneDigits.startsWith(digits)) return isPhoneHeavy ? 1 : 2;
    if (phoneDigits.endsWith(digits)) return isPhoneHeavy ? 1 : 2;
    if (phoneDigits.includes(digits)) return isPhoneHeavy ? 2 : 8;
  }

  if (tokens.length === 0) return 100;

  if (fullName === qNorm || fullName === tokens.join(" ")) return 0;
  if (fullName.startsWith(qNorm)) return 1;
  if (
    first === tokens[0] &&
    (tokens.length === 1 || last.startsWith(tokens[1]!))
  ) {
    return 2;
  }
  if (first.startsWith(tokens[0]!)) return 3;
  if (last.startsWith(tokens[0]!)) return 4;
  if (tokens.every((token) => fullName.includes(token))) return 5;

  return 50;
}

/** Prefixo SQL amplo (1ª letra + variantes com acento) para achar candidatos. */
export function nameSearchSqlPrefixes(token: string): string[] {
  const ch = normalizeText(token).replace(/[^a-z]/g, "")[0];
  if (!ch) return [];

  const variants: Record<string, string[]> = {
    a: ["a", "á", "à", "â", "ã"],
    c: ["c", "ç"],
    e: ["e", "é", "ê"],
    i: ["i", "í"],
    o: ["o", "ó", "ô", "õ"],
    u: ["u", "ú"],
  };

  return (variants[ch] ?? [ch]).map((v) => `${v}%`);
}
