import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { withIdempotency } from "@/lib/api/idempotency";

const mockMaybeSingle = vi.fn();
const mockInsert = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mockFrom }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockInsert.mockResolvedValue({ error: null });
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  mockFrom.mockReturnValue({
    select: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }),
    insert: mockInsert,
    delete: () => ({ lt: () => Promise.resolve({ error: null }) }),
  });
});

function baseOptions(overrides: Partial<Parameters<typeof withIdempotency>[1]> = {}) {
  return {
    route: "appointments.create",
    authIdentifier: "client:5511999998888",
    requestPayload: { date: "2026-08-10" },
    ...overrides,
  };
}

describe("withIdempotency", () => {
  it("sem header Idempotency-Key, chama o handler direto sem tocar no banco", async () => {
    const request = new Request("https://example.com/api/v1/appointments", {
      method: "POST",
    });
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));

    const response = await withIdempotency(request, baseOptions(), handler);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(mockFrom).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("primeira chamada com a chave: roda o handler e salva a resposta", async () => {
    const request = new Request("https://example.com/api/v1/appointments", {
      method: "POST",
      headers: { "Idempotency-Key": "chave-1" },
    });
    const handler = vi
      .fn()
      .mockResolvedValue(NextResponse.json({ ok: true, appointmentId: "abc" }));

    const response = await withIdempotency(request, baseOptions(), handler);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(await response.json()).toEqual({ ok: true, appointmentId: "abc" });
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        dedupe_key: "chave-1|appointments.create|client:5511999998888|",
        response_status: 200,
      })
    );
  });

  it("repetição com a mesma chave e mesmos dados: devolve a resposta salva sem repetir a ação", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        request_hash: hashOf({ date: "2026-08-10" }),
        response_status: 200,
        response_body: { ok: true, appointmentId: "abc" },
      },
      error: null,
    });
    const request = new Request("https://example.com/api/v1/appointments", {
      method: "POST",
      headers: { "Idempotency-Key": "chave-1" },
    });
    const handler = vi.fn();

    const response = await withIdempotency(request, baseOptions(), handler);

    expect(handler).not.toHaveBeenCalled();
    expect(response.headers.get("Idempotent-Replay")).toBe("true");
    expect(await response.json()).toEqual({ ok: true, appointmentId: "abc" });
  });

  it("mesma chave com dados diferentes: 409, sem repetir a ação", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        request_hash: hashOf({ date: "outro-dia" }),
        response_status: 200,
        response_body: { ok: true },
      },
      error: null,
    });
    const request = new Request("https://example.com/api/v1/appointments", {
      method: "POST",
      headers: { "Idempotency-Key": "chave-1" },
    });
    const handler = vi.fn();

    const response = await withIdempotency(request, baseOptions(), handler);

    expect(handler).not.toHaveBeenCalled();
    expect(response.status).toBe(409);
  });

  it("não grava resposta de erro do servidor (5xx)", async () => {
    const request = new Request("https://example.com/api/v1/appointments", {
      method: "POST",
      headers: { "Idempotency-Key": "chave-2" },
    });
    const handler = vi
      .fn()
      .mockResolvedValue(
        NextResponse.json({ error: "falhou" }, { status: 503 })
      );

    await withIdempotency(request, baseOptions(), handler);

    expect(mockInsert).not.toHaveBeenCalled();
  });
});

function hashOf(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
