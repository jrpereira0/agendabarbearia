export const API_SCOPES = [
  "catalog:read",
  "availability:read",
  "customers:read",
  "appointments:read",
  "appointments:create",
  "appointments:update",
  "appointments:cancel",
] as const;

export type ApiScope = (typeof API_SCOPES)[number];

export const API_SCOPE_LABELS: Record<ApiScope, string> = {
  "catalog:read": "Ver catálogo",
  "availability:read": "Consultar horários livres",
  "customers:read": "Buscar clientes",
  "appointments:read": "Listar agendamentos",
  "appointments:create": "Criar agendamentos",
  "appointments:update": "Remarcar agendamentos",
  "appointments:cancel": "Cancelar agendamentos",
};

export const ALL_API_SCOPES: ApiScope[] = [...API_SCOPES];

export const READONLY_API_SCOPES: ApiScope[] = [
  "catalog:read",
  "availability:read",
  "customers:read",
  "appointments:read",
];

export type ApiKeyPermissionPreset = "full" | "readonly" | "custom";

export const API_KEY_PRESET_LABELS: Record<
  Exclude<ApiKeyPermissionPreset, "custom">,
  string
> = {
  full: "Agenda completa",
  readonly: "Somente leitura",
};

export function scopesFromPreset(
  preset: ApiKeyPermissionPreset,
  customScopes: ApiScope[] = []
): ApiScope[] {
  if (preset === "full") return [...ALL_API_SCOPES];
  if (preset === "readonly") return [...READONLY_API_SCOPES];
  return normalizeScopes(customScopes);
}

export function normalizeScopes(scopes: string[]): ApiScope[] {
  const allowed = new Set<string>(API_SCOPES);
  const unique = [...new Set(scopes)].filter((s): s is ApiScope =>
    allowed.has(s)
  );
  return unique.length > 0 ? unique : [];
}

export function hasScope(scopes: readonly string[], required: ApiScope): boolean {
  return scopes.includes(required);
}

export function formatScopesSummary(scopes: readonly string[]): string {
  if (scopes.length === ALL_API_SCOPES.length) {
    return API_KEY_PRESET_LABELS.full;
  }
  if (
    scopes.length === READONLY_API_SCOPES.length &&
    READONLY_API_SCOPES.every((s) => scopes.includes(s))
  ) {
    return API_KEY_PRESET_LABELS.readonly;
  }
  return scopes.map((s) => API_SCOPE_LABELS[s as ApiScope] ?? s).join(", ");
}
