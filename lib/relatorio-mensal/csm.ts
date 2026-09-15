// Identidade e dados institucionais da CSM para o relatório mensal.
//
// A marca do documento é da CSM (decisão do usuário, 08/09/2026): o relatório
// retrata o trabalho da CSM, então carrega a marca de quem fez o trabalho —
// do mesmo jeito que o PowerPoint que ele substitui já é 100% CSM. O IGEDES
// aparece só como texto ("Cliente: IGEDES"), nunca como logo ou cor.
//
// Os campos "[... — PREENCHER]" são placeholders: o usuário vai fornecer
// endereço/CNPJ/contrato e um logo em alta resolução depois. Trocar aqui,
// nunca espalhar pelo código. O logo atual (public/relatorio-mensal/csm-logo.png)
// veio do canvas de design, reduzido pro editor — serve pra montar/ver,
// substituir por um em alta antes de entregar de verdade.

export const CSM_INSTITUCIONAL = {
  nomeFantasia: "CSM Construções e Facility",
  razaoSocial: "[RAZÃO SOCIAL — PREENCHER]",
  cnpj: "[CNPJ — PREENCHER]",
  endereco: "[ENDEREÇO — RUA, N°, BAIRRO — PREENCHER]",
  cidadeUfCep: "[CIDADE / UF · CEP — PREENCHER]",
  contato: "[TELEFONE] · [E-MAIL] — PREENCHER",
  contrato: "[N° DO CONTRATO — PREENCHER]",
  certificacoes: ["ISO 9001", "PBQP-H Nível A", "Compliance"],
} as const;

export const CLIENTE = {
  nome: "IGEDES",
  descricao: "Residências Terapêuticas · SRT",
  // Razão social do cliente (fornecida pelo usuário, 15/09/2026) — é o único
  // dado de identificação do cliente que aparece na folha de rosto; CNPJ e
  // contrato/NF foram retirados dali a pedido dele.
  razaoSocial: "INSTITUTO DE GESTÃO E DESENVOLVIMENTO",
} as const;

// Paleta extraída do canvas "Relatório Mensal CSM"
// (docs/referencias/capa-relatorio-design.zip) — hex
// SEM "#" (formato que o docx/exceljs usam). Não são as "cores operacionais"
// do CLAUDE.md (prioridade/SLA) — é a identidade da CSM, restrita a este
// documento.
export const CORES = {
  grafite: "434040",
  laranja: "FD8B2C",
  cinzaClaro: "D8DADE",
  cinzaMedio: "8E9095",
  cinzaTexto: "6B6B6B",
  cinzaRotulo: "8E9095",
  // Cabeçalho/rodapé de página (15/09/2026): cinzaTexto/cinzaMedio liam claro
  // demais impressos — mais escuro que os dois, mas de propósito longe do
  // preto (grafite é "quase preto" e foi descartado pro mesmo texto).
  cinzaCabecalho: "595959",
  quadroFundo: "F5F6F7",
  branco: "FFFFFF",
} as const;

// Lidos do disco (fs.readFileSync) dentro das rotas de geração — mesmo padrão
// de lib/relatorio/pdf/documento-relatorio.tsx.
export const ASSETS = {
  logo: "public/relatorio-mensal/csm-logo.png",
  capaObra: "public/relatorio-mensal/capa-obra.jpg",
} as const;
