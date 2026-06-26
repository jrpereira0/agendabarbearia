import { describe, expect, it } from "vitest";
import {
  buildFullApiKey,
  buildKeyPrefix,
  generateApiKeyMaterial,
  hashApiKeySecret,
  parseBearerApiKey,
  verifyApiKeySecret,
} from "@/lib/api-key-crypto";

describe("api-key-crypto", () => {
  it("gera material com formato dbc_live_<keyId>_<secret>", () => {
    const material = generateApiKeyMaterial();
    expect(material.fullKey).toMatch(/^dbc_live_[a-z0-9]{12}_[A-Za-z0-9_-]{43}$/);
    expect(material.keyPrefix).toBe(buildKeyPrefix(material.keyId));
    expect(material.fullKey).toBe(
      buildFullApiKey(material.keyId, material.secret)
    );
  });

  it("parseia Bearer válido", () => {
    const material = generateApiKeyMaterial();
    const parsed = parseBearerApiKey(`Bearer ${material.fullKey}`);
    expect(parsed).toEqual({
      keyPrefix: material.keyPrefix,
      secret: material.secret,
    });
  });

  it("rejeita chave ausente ou malformada", () => {
    expect(parseBearerApiKey(null)).toBeNull();
    expect(parseBearerApiKey("")).toBeNull();
    expect(parseBearerApiKey("Basic abc")).toBeNull();
    expect(parseBearerApiKey("Bearer curta")).toBeNull();
    expect(parseBearerApiKey("Bearer dbc_live_onlyprefix")).toBeNull();
  });

  it("verifica hash com comparação segura", async () => {
    const secret = "test-secret-value-32bytes-base64url!!";
    const hash = await hashApiKeySecret(secret);
    expect(await verifyApiKeySecret(secret, hash)).toBe(true);
    expect(await verifyApiKeySecret("wrong", hash)).toBe(false);
  });
});
