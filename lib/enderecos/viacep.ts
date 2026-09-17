// ViaCEP — CEP → logradouro/bairro/cidade/UF. Gratuito, sem chave, sem CORS
// restritivo (mas chamamos do servidor mesmo assim, junto com a
// geocodificação, pra manter a mesma convenção de "chave/rede sensível fica
// no server-only" do resto do projeto — aqui não tem chave, mas evita duas
// origens diferentes pro mesmo fluxo).
//
// Documento do usuário (16/09/2026) pede endereço estruturado + CEP como
// apoio pra geocodificação — este módulo resolve só a metade "CEP → campos
// estruturados"; `geocodificacao.ts` resolve "texto → coordenada".

export type EnderecoPorCep = {
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
};

/** Remove tudo que não é dígito e valida o tamanho — CEP é sempre texto, nunca número (perde zero à esquerda). */
export function normalizarCep(cepBruto: string): string | null {
  const digitos = cepBruto.replace(/\D/g, "");
  if (digitos.length !== 8) return null;
  return `${digitos.slice(0, 5)}-${digitos.slice(5)}`;
}

export async function buscarCep(cepBruto: string): Promise<EnderecoPorCep | null> {
  const cep = normalizarCep(cepBruto);
  if (!cep) return null;

  const resposta = await fetch(`https://viacep.com.br/ws/${cep.replace("-", "")}/json/`);
  if (!resposta.ok) return null;

  const json = (await resposta.json()) as Record<string, unknown>;
  if (json.erro) return null; // é assim que a ViaCEP sinaliza "CEP não encontrado" — não é HTTP error

  return {
    logradouro: (json.logradouro as string) ?? "",
    bairro: (json.bairro as string) ?? "",
    cidade: (json.localidade as string) ?? "",
    uf: (json.uf as string) ?? "",
  };
}
