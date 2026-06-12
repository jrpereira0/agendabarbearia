/** Página inicial do sistema: login do painel. */
export const LOGIN_PATH = "/";

export function loginUrl(erro?: string): string {
  if (!erro) return LOGIN_PATH;
  return `${LOGIN_PATH}?erro=${erro}`;
}
