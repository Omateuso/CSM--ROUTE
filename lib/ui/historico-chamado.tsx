// Versão mínima da Parte E da Fase 4 ("Histórico do chamado"), adiantada
// fora de ordem: a tabela `historico` é populada desde a Fase 3
// (servico_planejado/iniciado/concluido_tecnico) e ganhou `servico_reagendado`
// na 0018, mas nenhuma tela lia essa tabela até agora — motivo de
// reagendamento ficava gravado no banco sem aparecer em lugar nenhum.
// A linha do tempo completa (filtros, busca por chamado avulso) continua
// pra Parte E; isso aqui só lê e mostra os eventos de um chamado.
export type HistoricoEvento = {
  id: string;
  evento: string;
  descricao: string | null;
  criadoEm: string;
  criadoPorNome: string | null;
};

const EVENTO_LABEL: Record<string, string> = {
  servico_planejado: "Incluído na rota",
  servico_iniciado: "Atendimento iniciado",
  servico_concluido_tecnico: "Concluído pelo técnico",
  servico_reagendado: "Reagendado",
  servico_validado: "Validado pelo gerente",
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
