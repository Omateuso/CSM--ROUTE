import type { ReactElement } from "react";
import type { createClient } from "@/lib/supabase/server";

export type GrupoBloco = "agora" | "periodo";

export type Periodo = { inicio: string; fim: string }; // datas ISO "YYYY-MM-DD", inclusivas

// União fechada, não `string` solto — o catálogo (lib/relatorio/catalogo.ts)
// é a única fonte que popula essa lista; modal e página impressa dependem
// dela pra checar seleção sem digitar o id errado em algum lugar.
export type BlocoId =
  | "panorama_chamados_agora"
  | "rt_mais_chamados_agora"
  | "gargalos_agora"
  | "rotas_hoje"
  | "nucleos_agora"
  | "rt_mais_atendida_periodo"
  | "volume_regiao_periodo"
  | "cumprimento_sla_periodo"
  | "rotas_periodo";

// `supabase` aqui é sempre o client autenticado do servidor (lib/supabase/server)
// — os blocos nunca usam service role, então a RLS de `gestao` já em vigor
// desde 0001/0010 é quem garante o que pode ser lido, igual toda outra tela.
// Sem Database types gerados ainda (mesma situação do resto do projeto),
// então o tipo do client vem direto do retorno de createClient().
export type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type BlocoDef = {
  id: BlocoId;
  grupo: GrupoBloco;
  titulo: string;
  resumoCurto: string;
  padrao: boolean; // faz parte do preset "seleção padrão" do modal
};

export type BlocoModulo<TDados> = {
  definicao: BlocoDef;
  buscar: (supabase: SupabaseServerClient, periodo?: Periodo) => Promise<TDados>;
  resumoFrase: (dados: TDados) => string | null;
  Secao: (props: { dados: TDados }) => ReactElement;
  // Versão em componentes react-pdf da mesma seção — usada só pela geração
  // de PDF de verdade (app/(gestao)/relatorio/gerar/pdf/route.ts), texto
  // real/selecionável, não é o mesmo componente de `Secao` porque
  // react-pdf não roda em HTML/CSS (motor de layout próprio, sem <table>
  // nativa) — pedido do usuário, 27/08/2026: "Imprimir/Salvar como PDF"
  // sempre abria o diálogo de impressão do navegador, ele queria baixar
  // direto.
  SecaoPdf: (props: { dados: TDados }) => ReactElement;
};
