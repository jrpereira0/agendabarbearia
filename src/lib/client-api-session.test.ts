import { describe, expect, it } from "vitest";
import {
  createClientSessionToken,
  readClientSessionFromRequest,
  verifyClientSessionToken,
} from "@/lib/client-api-session";

describe("client-api-session", () => {
  it("cria e valida token de sessão", () => {
    process.env.CLIENT_SESSION_SECRET =
      "test-secret-with-at-least-32-characters!!";

    const token = createClientSessionToken("11981008852");
    expect(token).toBeTruthy();

    const payload = verifyClientSessionToken(token);
    expect(payload?.whatsapp).toBe("5511981008852");
    expect(payload?.v).toBe(0);
  });

  it("guarda a versão da sessão no token", () => {
    process.env.CLIENT_SESSION_SECRET =
      "test-secret-with-at-least-32-characters!!";

    const token = createClientSessionToken("11981008852", 3);
    const payload = verifyClientSessionToken(token);
    expect(payload?.v).toBe(3);
  });

  it("rejeita token adulterado", () => {
    process.env.CLIENT_SESSION_SECRET =
      "test-secret-with-at-least-32-characters!!";

    const token = createClientSessionToken("11981008852");
    expect(verifyClientSessionToken(`${token}x`)).toBeNull();
  });

  it("aceita token no Authorization Bearer (app mobile)", () => {
    process.env.CLIENT_SESSION_SECRET =
      "test-secret-with-at-least-32-characters!!";

    const token = createClientSessionToken("11981008852");
    expect(token).toBeTruthy();

    const request = new Request("http://localhost/api/v1/appointments", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const session = readClientSessionFromRequest(request);
    expect(session?.whatsapp).toBe("5511981008852");
  });

  it("não trata chave de API como sessão de cliente", () => {
    process.env.CLIENT_SESSION_SECRET =
      "test-secret-with-at-least-32-characters!!";

    const request = new Request("http://localhost/api/v1/appointments", {
      headers: {
        Authorization:
          "Bearer dbc_live_abcdef123456_abcdefghijklmnopqrstuvwxyz0123456789abc",
      },
    });

    expect(readClientSessionFromRequest(request)).toBeNull();
  });
});
