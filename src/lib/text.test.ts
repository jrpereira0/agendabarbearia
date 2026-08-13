import { describe, expect, it } from "vitest";
import {
  canRunCustomerSearch,
  matchesCustomerSearch,
  rankCustomerSearch,
} from "@/lib/text";

const joao = {
  firstName: "João",
  lastName: "Silva",
  whatsapp: "11999887766",
};

const maria = {
  firstName: "Maria",
  lastName: "Souza",
  whatsapp: "21988776655",
};

describe("canRunCustomerSearch", () => {
  it("pede 2 letras no nome", () => {
    expect(canRunCustomerSearch("j")).toBe(false);
    expect(canRunCustomerSearch("jo")).toBe(true);
  });

  it("pede 3 dígitos no telefone", () => {
    expect(canRunCustomerSearch("99")).toBe(false);
    expect(canRunCustomerSearch("998")).toBe(true);
  });
});

describe("matchesCustomerSearch", () => {
  it("aceita busca vazia", () => {
    expect(matchesCustomerSearch(joao, "")).toBe(true);
  });

  it("acha com 2 letras e sem acento", () => {
    expect(matchesCustomerSearch(joao, "jo")).toBe(true);
    expect(matchesCustomerSearch(joao, "ao")).toBe(true);
    expect(matchesCustomerSearch(joao, "jose")).toBe(false);
    expect(matchesCustomerSearch({ ...joao, firstName: "José" }, "jose")).toBe(
      true
    );
    expect(matchesCustomerSearch({ ...joao, firstName: "José" }, "se")).toBe(
      true
    );
  });

  it("acha por nome completo em qualquer ordem", () => {
    expect(matchesCustomerSearch(joao, "joao silva")).toBe(true);
    expect(matchesCustomerSearch(joao, "silva joao")).toBe(true);
  });

  it("acha só pelo sobrenome", () => {
    expect(matchesCustomerSearch(joao, "silva")).toBe(true);
    expect(matchesCustomerSearch(joao, "si")).toBe(true);
  });

  it("não mistura pedaços de outro cliente", () => {
    expect(matchesCustomerSearch(joao, "maria silva")).toBe(false);
    expect(matchesCustomerSearch(maria, "joao")).toBe(false);
  });

  it("acha telefone com 3 dígitos no começo, meio ou fim", () => {
    expect(matchesCustomerSearch(joao, "119")).toBe(true);
    expect(matchesCustomerSearch(joao, "988")).toBe(true);
    expect(matchesCustomerSearch(joao, "766")).toBe(true);
    // Com 2 dígitos ainda não filtra (usuário ainda digitando).
    expect(matchesCustomerSearch(joao, "99")).toBe(true);
    expect(canRunCustomerSearch("99")).toBe(false);
  });
});

describe("rankCustomerSearch", () => {
  it("prioriza começo do nome e WhatsApp", () => {
    const byName = rankCustomerSearch(joao, "joao");
    const byLast = rankCustomerSearch(joao, "silva");
    const byPhoneEnd = rankCustomerSearch(joao, "766");
    expect(byName).toBeLessThan(byLast);
    expect(byPhoneEnd).toBeLessThan(10);
  });
});
