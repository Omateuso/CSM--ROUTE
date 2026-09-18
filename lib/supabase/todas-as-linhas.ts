// O PostgREST devolve no máximo 1.000 linhas por consulta (configuração
// `max-rows` do projeto) — e faz isso EM SILÊNCIO: sem erro, só corta. Isso
// passou despercebido enquanto o banco tinha ~500 chamados; com o resgate dos
// abertos antigos do TomTicket (18/09/2026) ele passou de 1.300, com mais de
// 1.100 ABERTOS, e a tela de chamados (ordenada do mais novo pro mais antigo)
// passaria a esconder justamente os mais antigos — o problema que o resgate
// veio resolver.
//
// Toda consulta que pode passar de 1.000 linhas (chamados sem filtro de RT,
// chamados abertos, respostas) passa por aqui: pagina com `.range()` até vir
// uma página incompleta e devolve `{ data, error }` no mesmo formato do
// builder, então o `const { data, error } = await ...` de quem chama não muda.
//
// A `fabrica` é chamada uma vez por página porque o builder do Supabase é
// mutável — `.range()` grava no próprio objeto — e reaproveitar um só
// funcionaria por acidente. Consulta SEM `.order()` tem ordem indefinida entre
// páginas no Postgres; ponha um `.order()` estável (id serve) na fábrica.

type Pagina<T, E> = PromiseLike<{ data: T[] | null; error: E | null }>;

type ComRange<T, E> = { range(de: number, ate: number): Pagina<T, E> };

const TAMANHO_DA_PAGINA = 1000;

export async function todasAsLinhas<T, E>(
  fabrica: () => ComRange<T, E>,
): Promise<{ data: T[] | null; error: E | null }> {
  const linhas: T[] = [];
  for (let de = 0; ; de += TAMANHO_DA_PAGINA) {
    const { data, error } = await fabrica().range(de, de + TAMANHO_DA_PAGINA - 1);
    if (error) return { data: null, error };
    if (data) linhas.push(...data);
    if (!data || data.length < TAMANHO_DA_PAGINA) break;
  }
  return { data: linhas, error: null };
}
