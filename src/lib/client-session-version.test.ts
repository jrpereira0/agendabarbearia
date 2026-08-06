import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  bumpClientSessionVersion,
  getClientSessionVersion,
  resolveValidClientSession,
} from "@/lib/client-session-version";

const mockMaybeSingle = vi.fn();
const mockUpsert = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mockFrom }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockUpsert.mockResolvedValue({ error: null });
  mockFrom.mockReturnValue({
    select: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }),
    upsert: mockUpsert,
  });
});

describe("getClientSessionVersion", () => {
  it("sem registro salvo, devolve versão 0", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await getClientSessionVersion("11999998888")).toBe(0);
  });

  it("devolve a versão salva", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { version: 3 }, error: null });
    expect(await getClientSessionVersion("11999998888")).toBe(3);
  });

  it("WhatsApp inválido devolve 0", async () => {
    expect(await getClientSessionVersion("123")).toBe(0);
  });
});

describe("bumpClientSessionVersion", () => {
  it("sem registro salvo, cria com versão 1", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const result = await bumpClientSessionVersion("11999998888");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.version).toBe(1);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ whatsapp: "5511999998888", version: 1 }),
      { onConflict: "whatsapp" }
    );
  });

  it("com registro salvo, incrementa a versão", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { version: 2 }, error: null });
    const result = await bumpClientSessionVersion("11999998888");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.version).toBe(3);
  });

  it("recusa WhatsApp inválido", async () => {
    const result = await bumpClientSessionVersion("123");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.httpStatus).toBe(400);
  });

  it("retorna erro 500 se o upsert falhar", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockUpsert.mockResolvedValue({ error: { message: "boom" } });
    const result = await bumpClientSessionVersion("11999998888");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.httpStatus).toBe(500);
  });
});

describe("resolveValidClientSession", () => {
  it("null devolve null", async () => {
    expect(await resolveValidClientSession(null)).toBeNull();
  });

  it("versão do token igual à atual, mantém válido", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { version: 1 }, error: null });
    const payload = { whatsapp: "5511999998888", exp: Date.now() + 1000, v: 1 };
    expect(await resolveValidClientSession(payload)).toEqual(payload);
  });

  it("versão do token menor que a atual (revogado), devolve null", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { version: 2 }, error: null });
    const payload = { whatsapp: "5511999998888", exp: Date.now() + 1000, v: 1 };
    expect(await resolveValidClientSession(payload)).toBeNull();
  });
});
