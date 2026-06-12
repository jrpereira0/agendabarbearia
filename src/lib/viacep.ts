export type ViaCepAddress = {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
};

type ViaCepResponse = {
  cep: string;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
};

export async function fetchAddressByCep(
  cep: string
): Promise<ViaCepAddress | { error: string }> {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) {
    return { error: "Informe um CEP com 8 dígitos." };
  }

  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    if (!res.ok) {
      return { error: "Não foi possível buscar o CEP. Tente de novo." };
    }

    const data = (await res.json()) as ViaCepResponse;
    if (data.erro || !data.logradouro) {
      return { error: "CEP não encontrado." };
    }

    return {
      cep: digits,
      street: data.logradouro,
      neighborhood: data.bairro,
      city: data.localidade,
      state: data.uf,
    };
  } catch {
    return { error: "Não foi possível buscar o CEP. Verifique sua conexão." };
  }
}
