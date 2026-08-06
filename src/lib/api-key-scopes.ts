export const API_SCOPES = [
  "catalog:read",
  "availability:read",
  "customers:read",
  "customers:update",
  "appointments:read",
  "appointments:create",
  "appointments:update",
  "appointments:cancel",
  "appointment_reminders:read",
  "appointment_reminders:write",
  "ai_status:read",
  "ai_status:write",
] as const;

export type ApiScope = (typeof API_SCOPES)[number];

export const API_SCOPE_LABELS: Record<ApiScope, string> = {
  "catalog:read": "Ver serviços e profissionais",
  "availability:read": "Consultar horários livres (agendamentos)",
  "customers:read": "Buscar clientes",
  "customers:update": "Atualizar cadastro do cliente",
  "appointments:read": "Listar agendamentos",
  "appointments:create": "Criar agendamentos",
  "appointments:update": "Remarcar e atualizar status",
  "appointments:cancel": "Cancelar agendamentos",
  "appointment_reminders:read": "Consultar lembretes de agendamento",
  "appointment_reminders:write": "Enviar e confirmar lembretes",
  "ai_status:read": "Consultar se a IA está ativa numa conversa",
  "ai_status:write": "Ativar ou pausar a IA numa conversa",
};

export const ALL_API_SCOPES: ApiScope[] = [...API_SCOPES];

export const READONLY_API_SCOPES: ApiScope[] = [
  "catalog:read",
  "availability:read",
  "customers:read",
  "appointments:read",
  "ai_status:read",
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
