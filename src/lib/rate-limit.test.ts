import { describe, expect, it } from "vitest";
import { checkRateLimit } from "@/lib/rate-limit";

describe("rate-limit api key", () => {
  it("limita requisições por keyId", () => {
    const config = { limit: 2, windowMs: 60_000 };
    const key = `apiKey:test-key-${Date.now()}`;

    expect(checkRateLimit(key, config).ok).toBe(true);
    expect(checkRateLimit(key, config).ok).toBe(true);
    const blocked = checkRateLimit(key, config);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    }
  });
});
