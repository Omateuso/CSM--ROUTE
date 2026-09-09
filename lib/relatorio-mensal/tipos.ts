// Tipos do relatório mensal CSM (ANEXO 1 + documento de evidências).
// Módulo IRMÃO de lib/relatorio/ (o relatório "sob demanda" da gestão) — mesma
// forma (consulta isolada + rota de geração que devolve download), sem
// compartilhar o timbrado: aquele é IGEDES, este é CSM (ver csm.ts).

export type FiltroRelatorioMensal = {
  inicio: string; // "YYYY-MM-DD" inclusivo
  fim: string; // "YYYY-MM-DD" inclusivo
  capsId: string | null;
  regiaoId: string | null;
};

// Uma linha = um serviço `validado` no período. O relatório é de conferência:
// `validado` é o único estado em que o gerente confirmou o que foi feito
// (decisão do usuário, 08/09/2026). `chamados.status` NÃO entra nessa conta —
// desde a migration 0015 ele é só espelho do TomTicket, não sinal de execução.
export type ServicoRelatorio = {
  servicoId: string;
  protocolo: string; // chamados.tomticket_id (fictícios = faixa 900000+); "—" se nulo
  assunto: string; // chamados.assunto — o PROBLEMA (coluna "SERVIÇO REALIZADO" do ANEXO 1)
  servicoExecutado: string; // conclusoes.observacao — o QUE FOI FEITO (coluna nova, ao lado)
  concluidoEm: string; // servicos.concluido_em (ISO)
  prioridade: string;
  chamadoCriadoEm: string | null;
  rtCodigo: string;
  rtNome: string;
  rtEndereco: string;
  rtBairro: string;
  regiaoNome: string;
  capsNome: string;
  osPath: string | null; // evidencias tipo='os'
  fotoAntesPath: string | null; // evidencias tipo='foto' momento='antes' (Pacote 1, migration 0023)
  fotoDepoisPath: string | null; // evidencias tipo='foto' momento='depois'
};

export type ResumoPeriodo = {
  totalServicos: number;
  totalRts: number; // RTs distintas atendidas
  totalCaps: number; // CAPS distintos
  porCaps: { nome: string; total: number }[]; // desc por volume — eixo principal da CSM (seção 8 do prompt)
};

export type AlertasPreview = {
  semOs: number;
  semFotoAntes: number;
  semFotoDepois: number;
};
