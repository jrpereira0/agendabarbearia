/** Login do painel admin. */
export const LOGIN_PATH = "/login-admin";

export function loginUrl(erro?: string): string {
  if (!erro) return LOGIN_PATH;
  return `${LOGIN_PATH}?erro=${erro}`;
}
