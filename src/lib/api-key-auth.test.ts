import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildFullApiKey,
  generateApiKeyMaterial,
  hashApiKeySecret,
} from "@/lib/api-key-crypto";
import {
  validateApiKeyFromRequest,
  validateApiKeyRecord,
} from "@/lib/api-key-auth";

const mockMaybeSingle = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: mockFrom,
  }),
}));

function mockKeyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "uuid-1",
    shop_id: 1,
    secret_hash: "",
    scopes: ["catalog:read", "availability:read"],
    active: true,
    expires_at: null,
    revoked_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFrom.mockReturnValue({
    select: () => ({
      eq: () => ({
        maybeSingle: mockMaybeSingle,
      }),
    }),
    update: () => ({
      eq: () => Promise.resolve({ error: null }),
    }),
  });
});

describe("api-key-auth", () => {
  it("retorna 401 quando Bearer está ausente em validação obrigatória", async () => {
    const request = new Request("https://example.com/api/v1/services");
    const result = await validateApiKeyFromRequest(request, "catalog:read");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });

  it("retorna 401 para keyId inexistente", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const material = generateApiKeyMaterial();
    const request = new Request("https://example.com", {
      headers: { Authorization: `Bearer ${material.fullKey}` },
    });
    const result = await validateApiKeyFromRequest(request, "catalog:read");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });

  it("retorna 401 para segredo incorreto", async () => {
    const material = generateApiKeyMaterial();
    const hash = await hashApiKeySecret("outro-segredo");
    mockMaybeSingle.mockResolvedValue({
      data: mockKeyRow({ secret_hash: hash }),
      error: null,
    });

    const result = await validateApiKeyRecord(
      material.keyPrefix,
      material.secret,
      "catalog:read"
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(await result.response.json()).toEqual({
        ok: false,
        error: "Não autorizado.",
      });
    }
  });

  it("retorna 401 para chave revogada ou expirada", async () => {
    const material = generateApiKeyMaterial();
    const hash = await hashApiKeySecret(material.secret);

    mockMaybeSingle.mockResolvedValueOnce({
      data: mockKeyRow({ secret_hash: hash, revoked_at: new Date().toISOString() }),
      error: null,
    });
    let result = await validateApiKeyRecord(
      material.keyPrefix,
      material.secret,
      "catalog:read"
    );
    expect(result.ok).toBe(false);

    mockMaybeSingle.mockResolvedValueOnce({
      data: mockKeyRow({
        secret_hash: hash,
        expires_at: "2020-01-01T00:00:00.000Z",
      }),
      error: null,
    });
    result = await validateApiKeyRecord(
      material.keyPrefix,
      material.secret,
      "catalog:read"
    );
    expect(result.ok).toBe(false);
  });

  it("retorna 403 sem scope necessário", async () => {
    const material = generateApiKeyMaterial();
    const hash = await hashApiKeySecret(material.secret);
    mockMaybeSingle.mockResolvedValue({
      data: mockKeyRow({
        secret_hash: hash,
        scopes: ["catalog:read"],
      }),
      error: null,
    });

    const result = await validateApiKeyRecord(
      material.keyPrefix,
      material.secret,
      "appointments:create"
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(await result.response.json()).toEqual({
        ok: false,
        error: "Sem permissão.",
      });
    }
  });

  it("aceita chave válida com scope correto", async () => {
    const material = generateApiKeyMaterial();
    const hash = await hashApiKeySecret(material.secret);
    mockMaybeSingle.mockResolvedValue({
      data: mockKeyRow({ secret_hash: hash }),
      error: null,
    });

    const result = await validateApiKeyRecord(
      material.keyPrefix,
      material.secret,
      "catalog:read"
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.auth.shopId).toBe(1);
      expect(result.auth.keyUuid).toBe("uuid-1");
    }
  });

  it("não vaza detalhes em mensagens de erro", async () => {
    const material = generateApiKeyMaterial();
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const request = new Request("https://example.com", {
      headers: {
        Authorization: `Bearer ${buildFullApiKey(material.keyId, "x".repeat(43))}`,
      },
    });
    const result = await validateApiKeyFromRequest(request, "catalog:read");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const body = await result.response.json();
      expect(body).toEqual({ ok: false, error: "Não autorizado." });
    }
  });
});
