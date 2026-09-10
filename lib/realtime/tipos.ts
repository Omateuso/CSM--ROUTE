// Contrato de tempo real do sistema.
//
// Existe para a migração do Supabase pro servidor interno: hoje o transporte
// é o Realtime do Supabase (postgres_changes); amanhã pode ser Socket.io no
// servidor próprio. Trocar significa escrever um adaptador novo — nenhuma
// tela precisa saber qual está em uso. Ver docs/migracao-servidor-interno.md.
//
// O contrato é deliberadamente pobre: "alguma coisa mudou nestas tabelas,
// vá buscar de novo". Nenhuma tela do projeto usa o PAYLOAD do evento — todas
// chamam `router.refresh()` e deixam o Server Component refazer a consulta.
// Um contrato que entregasse a linha alterada amarraria o formato do
// Postgres a qualquer transporte futuro sem necessidade.

export type EventoTabela = "INSERT" | "UPDATE" | "DELETE" | "*";

export type AlvoRealtime = {
  tabela: string;
  evento?: EventoTabela;
};

export type Assinatura = {
  encerrar: () => void;
};

export type OpcoesAssinatura = {
  /** Nome do canal — único por tela, pra dois componentes não brigarem. */
  canal: string;
  alvos: readonly AlvoRealtime[];
  /** Chamado a cada mudança relevante. */
  aoMudar: () => void;
  /** Reflete o estado da conexão (o indicador "Ao vivo" do dashboard). */
  aoConectar?: (conectado: boolean) => void;
};

export interface AdaptadorRealtime {
  nome: string;
  assinar(opcoes: OpcoesAssinatura): Assinatura;
}
