import { describe, expect, it } from "vitest";
import { checkRateLimit } from "@/lib/rate-limit";

describe("rate-limit api key", () => {
  it("limita requisições por keyId", async () => {
    const config = { limit: 2, windowMs: 60_000 };
    const key = `apiKey:test-key-${Date.now()}`;

    expect((await checkRateLimit(key, config)).ok).toBe(true);
    expect((await checkRateLimit(key, config)).ok).toBe(true);
    const blocked = await checkRateLimit(key, config);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    }
  });
});
