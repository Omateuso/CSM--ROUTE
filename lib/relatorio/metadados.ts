import type { BlocoDef } from "./types";

// Só dados (id/grupo/título/preset) — sem importar nenhum módulo de bloco
// (que puxa Supabase, JSX de renderização etc.). É o que o modal do client
// (gerador-modal.tsx) lê pra montar os checkboxes; cada bloco em blocos/*.tsx
// importa sua própria constante daqui em vez de duplicar o objeto, e
// catalogo.ts (só usado no servidor) junta isso com buscar/Secao de cada um.
export const DEF_PANORAMA_CHAMADOS_AGORA: BlocoDef = {
  id: "panorama_chamados_agora",
  grupo: "agora",
  titulo: "Panorama de chamados",
  resumoCurto: "Abertos, críticos e SLA vencido agora",
  padrao: true,
};

export const DEF_RT_MAIS_CHAMADOS_AGORA: BlocoDef = {
  id: "rt_mais_chamados_agora",
  grupo: "agora",
  titulo: "RTs com mais chamados",
  resumoCurto: "Ranking de chamados abertos agora",
  padrao: false,
};

export const DEF_GARGALOS_AGORA: BlocoDef = {
  id: "gargalos_agora",
  grupo: "agora",
  titulo: "Gargalos atuais",
  resumoCurto: "Aguardando validação + travados",
  padrao: true,
};

export const DEF_ROTAS_HOJE: BlocoDef = {
  id: "rotas_hoje",
  grupo: "agora",
  titulo: "Rotas de hoje",
  resumoCurto: "Rotas confirmadas para hoje",
  padrao: false,
};

export const DEF_NUCLEOS_AGORA: BlocoDef = {
  id: "nucleos_agora",
  grupo: "agora",
  titulo: "Núcleos operacionais",
  resumoCurto: "RTs próximas com concentração de chamados agora",
  padrao: false,
};

export const DEF_RT_MAIS_ATENDIDA_PERIODO: BlocoDef = {
  id: "rt_mais_atendida_periodo",
  grupo: "periodo",
  titulo: "RT mais atendida",
  resumoCurto: "Mais serviços concluídos no período",
  padrao: false,
};

export const DEF_VOLUME_REGIAO_PERIODO: BlocoDef = {
  id: "volume_regiao_periodo",
  grupo: "periodo",
  titulo: "Volume por região",
  resumoCurto: "Chamados por região/zona no período",
  padrao: true,
};

export const DEF_CUMPRIMENTO_SLA_PERIODO: BlocoDef = {
  id: "cumprimento_sla_periodo",
  grupo: "periodo",
  titulo: "Cumprimento de SLA",
  resumoCurto: "% dentro do prazo no período",
  padrao: true,
};

export const DEF_ROTAS_PERIODO: BlocoDef = {
  id: "rotas_periodo",
  grupo: "periodo",
  titulo: "Rotas no período",
  resumoCurto: "Quantidade, equipes e RTs cobertas",
  padrao: true,
};

export const BLOCO_DEFS: BlocoDef[] = [
  DEF_PANORAMA_CHAMADOS_AGORA,
  DEF_RT_MAIS_CHAMADOS_AGORA,
  DEF_GARGALOS_AGORA,
  DEF_ROTAS_HOJE,
  DEF_NUCLEOS_AGORA,
  DEF_RT_MAIS_ATENDIDA_PERIODO,
  DEF_VOLUME_REGIAO_PERIODO,
  DEF_CUMPRIMENTO_SLA_PERIODO,
  DEF_ROTAS_PERIODO,
];

export const BLOCOS_AGORA_DEFS = BLOCO_DEFS.filter((b) => b.grupo === "agora");
export const BLOCOS_PERIODO_DEFS = BLOCO_DEFS.filter((b) => b.grupo === "periodo");
export const IDS_PADRAO = BLOCO_DEFS.filter((b) => b.padrao).map((b) => b.id);
