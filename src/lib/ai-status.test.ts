import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAiStatus, setAiStatus } from "@/lib/ai-status";

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

describe("ai-status", () => {
  it("recusa WhatsApp inválido", async () => {
    const result = await getAiStatus("123");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.httpStatus).toBe(400);
  });

  it("sem registro salvo, considera a IA ativa por padrão", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const result = await getAiStatus("11999998888");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toEqual({
        whatsapp: "5511999998888",
        iaAtiva: true,
      });
    }
  });

  it("devolve o valor salvo quando existe registro", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { ia_ativa: false },
      error: null,
    });
    const result = await getAiStatus("5511999998888");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.status.iaAtiva).toBe(false);
  });

  it("grava o novo status via upsert", async () => {
    const result = await setAiStatus("11999998888", false);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toEqual({
        whatsapp: "5511999998888",
        iaAtiva: false,
      });
    }
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        session_id: "5511999998888",
        ia_ativa: false,
      }),
      { onConflict: "session_id" }
    );
  });

  it("retorna erro 500 se o upsert falhar", async () => {
    mockUpsert.mockResolvedValue({ error: { message: "boom" } });
    const result = await setAiStatus("11999998888", true);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.httpStatus).toBe(500);
  });
});
