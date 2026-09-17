// Formato de entrada agnóstico de banco: `actions.ts` monta isso a partir das
// tabelas `relatorios_rt`/`relatorios_rt_fotos`/`rts`/`caps`/`chamados`/
// `profiles`; `docx.ts` só sabe montar o documento a partir daqui — não
// conhece Supabase nem nomes de coluna.

export type FotoRelatorioRt = {
  storagePath: string;
  legenda: string | null;
};

// `tomticketId` nulo com `chamado` não-nulo acontece de verdade (ex.: um
// chamado nascido de uma urgência, migrations 0027/0045, ainda sem
// protocolo do TomTicket) — `docx.ts` decide o rótulo a partir dos dois
// campos, nunca assume que um implica o outro.
export type ChamadoRelacionado = {
  tomticketId: string | null;
  assunto: string;
};

export type RelatorioRtParaDocx = {
  assunto: string;
  relatoTecnico: string;
  encaminhamento: string | null;
  criadoEm: string; // ISO
  rt: {
    codigo: string;
    nome: string;
    endereco: string;
    bairro: string;
    capsNome: string;
  };
  chamado: ChamadoRelacionado | null;
  responsavelNome: string;
  fotos: FotoRelatorioRt[];
};
