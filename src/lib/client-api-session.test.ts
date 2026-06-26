import { describe, expect, it } from "vitest";
import {
  createClientSessionToken,
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
  });

  it("rejeita token adulterado", () => {
    process.env.CLIENT_SESSION_SECRET =
      "test-secret-with-at-least-32-characters!!";

    const token = createClientSessionToken("11981008852");
    expect(verifyClientSessionToken(`${token}x`)).toBeNull();
  });
});
