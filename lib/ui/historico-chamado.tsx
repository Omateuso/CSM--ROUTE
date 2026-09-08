// Versão mínima da Parte E da Fase 4 ("Histórico do chamado"), adiantada
// fora de ordem: a tabela `historico` é populada desde a Fase 3
// (servico_planejado/iniciado/concluido_tecnico) e ganhou `servico_reagendado`
// na 0018, mas nenhuma tela lia essa tabela até agora — motivo de
// reagendamento ficava gravado no banco sem aparecer em lugar nenhum.
// A linha do tempo completa (filtros, busca por chamado avulso) continua
// pra Parte E; isso aqui só lê e mostra os eventos de um chamado.
import { PENDENCIA_CATEGORIA_LABEL, type PendenciaCategoria } from "./pendencia-categoria";

export type HistoricoEvento = {
  id: string;
  evento: string;
  descricao: string | null;
  categoria: string | null;
  criadoEm: string;
  criadoPorNome: string | null;
};

const EVENTO_LABEL: Record<string, string> = {
  servico_planejado: "Incluído na rota",
  servico_iniciado: "Atendimento iniciado",
  servico_concluido_tecnico: "Concluído pelo técnico",
  servico_reagendado: "Reagendado",
  servico_validado: "Validado pelo gerente",
  rota_data_corrigida: "Data da rota corrigida",
  servico_recusado: "Recusado pelo gerente",
  servico_pendente_material: "Pendência de material", // nome antigo (0025) — mantido pra dado de teste já gravado
  servico_pendente: "Pendência reportada",
  // Resposta enviada ao chamado no TomTicket, com os anexos (0028). A
  // `descricao` guarda o texto exato que o cliente recebeu.
  tomticket_respondido: "Respondido no TomTicket",
  // Central de Urgências (0027) — eventos gravados por urgencia_id antes do
  // chamado existir, e por chamado_id (também) a partir da decisão de
  // atendimento — a mesma timeline combina os dois.
  urgencia_registrada: "Urgência registrada",
  urgencia_em_analise: "Urgência em análise",
  urgencia_validada: "Urgência validada",
  urgencia_nao_validada: "Urgência não validada",
  urgencia_cancelada: "Urgência cancelada",
  urgencia_atendimento_decidido: "Atendimento decidido",
  urgencia_vinculada_tomticket: "Vinculado ao TomTicket",
};

const formatoDataHora = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function HistoricoChamado({ eventos }: { eventos: HistoricoEvento[] }) {
  if (eventos.length === 0) return null;

  return (
    <div>
      <p className="text-xs font-medium text-text-secondary">Histórico do chamado</p>
      <ol className="mt-2 flex flex-col gap-2 border-l border-border pl-3">
        {eventos.map((e) => (
          <li key={e.id} className="text-xs">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-medium text-text-primary">{EVENTO_LABEL[e.evento] ?? e.evento}</span>
              {e.categoria && (
                <span className="text-text-secondary">
                  ({PENDENCIA_CATEGORIA_LABEL[e.categoria as PendenciaCategoria] ?? e.categoria})
                </span>
              )}
              <span className="text-text-tertiary">{formatoDataHora.format(new Date(e.criadoEm))}</span>
              {e.criadoPorNome && <span className="text-text-tertiary">· {e.criadoPorNome}</span>}
            </div>
            {e.descricao && <p className="mt-0.5 whitespace-pre-wrap text-text-secondary">{e.descricao}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}
