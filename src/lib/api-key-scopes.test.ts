import { describe, expect, it } from "vitest";
import {
  ALL_API_SCOPES,
  hasScope,
  normalizeScopes,
  READONLY_API_SCOPES,
  scopesFromPreset,
} from "@/lib/api-key-scopes";

describe("api-key-scopes", () => {
  it("mapeia presets para scopes", () => {
    expect(scopesFromPreset("full")).toEqual(ALL_API_SCOPES);
    expect(scopesFromPreset("readonly")).toEqual(READONLY_API_SCOPES);
    expect(scopesFromPreset("custom", ["catalog:read"])).toEqual([
      "catalog:read",
    ]);
  });

  it("ignora scopes desconhecidos", () => {
    expect(normalizeScopes(["catalog:read", "hack:all"])).toEqual([
      "catalog:read",
    ]);
    expect(normalizeScopes([])).toEqual([]);
  });

  it("valida scope necessário", () => {
    expect(hasScope(["catalog:read"], "catalog:read")).toBe(true);
    expect(hasScope(["catalog:read"], "appointments:create")).toBe(false);
  });
});
