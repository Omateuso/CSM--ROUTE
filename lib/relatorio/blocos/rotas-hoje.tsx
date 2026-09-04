import { SecaoRelatorio, Tabela, SemDados } from "../componentes-impressao";
import { SecaoRelatorioPdf, TabelaPdf, SemDadosPdf } from "../pdf/componentes-impressao-pdf";
import { DEF_ROTAS_HOJE } from "../metadados";
import type { BlocoModulo, SupabaseServerClient } from "../types";

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

type LinhaRota = { regiao: string; equipe: string; qtdRts: number };
type Dados = { rotas: LinhaRota[] };

async function buscar(supabase: SupabaseServerClient): Promise<Dados> {
  const hoje = new Date().toISOString().slice(0, 10);

  const { data: rotasRaw, error } = await supabase
    .from("rotas")
    .select("id, regioes(nome), equipes(nome)")
    .eq("data", hoje)
    .eq("status", "confirmada");
  if (error) throw new Error(error.message);

  const rotaIds = (rotasRaw ?? []).map((r) => r.id as string);
  const { data: rotaRtsRaw, error: erroRotaRts } =
    rotaIds.length > 0
      ? await supabase.from("rota_rts").select("rota_id").in("rota_id", rotaIds)
      : { data: [], error: null };
  if (erroRotaRts) throw new Error(erroRotaRts.message);

  const qtdPorRota = new Map<string, number>();
  for (const rr of rotaRtsRaw ?? []) {
    const chave = rr.rota_id as string;
    qtdPorRota.set(chave, (qtdPorRota.get(chave) ?? 0) + 1);
  }

  const rotas: LinhaRota[] = (rotasRaw ?? []).map((r) => ({
    regiao: unwrapOne(r.regioes)?.nome ?? "—",
    equipe: unwrapOne(r.equipes)?.nome ?? "—",
    qtdRts: qtdPorRota.get(r.id as string) ?? 0,
  }));

  return { rotas };
}

function resumoFrase(dados: Dados): string {
  if (dados.rotas.length === 0) return "Nenhuma rota confirmada para hoje.";
  const totalRts = dados.rotas.reduce((soma, r) => soma + r.qtdRts, 0);
  return `Hoje há ${dados.rotas.length} rota(s) confirmada(s), cobrindo ${totalRts} RT(s).`;
}

function Secao({ dados }: { dados: Dados }) {
  return (
    <SecaoRelatorio titulo="Rotas confirmadas para hoje" subtitulo="Dado atual.">
      {dados.rotas.length === 0 ? (
        <SemDados>Nenhuma rota confirmada para hoje.</SemDados>
      ) : (
        <Tabela colunas={["Região", "Equipe", "RTs na rota"]}>
          {dados.rotas.map((rota, indice) => (
            <tr key={indice}>
              <td>{rota.regiao}</td>
              <td>{rota.equipe}</td>
              <td>{rota.qtdRts}</td>
            </tr>
          ))}
        </Tabela>
      )}
    </SecaoRelatorio>
  );
}

function SecaoPdf({ dados }: { dados: Dados }) {
  return (
    <SecaoRelatorioPdf titulo="Rotas confirmadas para hoje" subtitulo="Dado atual.">
      {dados.rotas.length === 0 ? (
        <SemDadosPdf>Nenhuma rota confirmada para hoje.</SemDadosPdf>
      ) : (
        <TabelaPdf
          colunas={["Região", "Equipe", "RTs na rota"]}
          linhas={dados.rotas.map((rota) => [rota.regiao, rota.equipe, rota.qtdRts])}
        />
      )}
    </SecaoRelatorioPdf>
  );
}

export const rotasHoje: BlocoModulo<Dados> = {
  definicao: DEF_ROTAS_HOJE,
  buscar,
  resumoFrase,
  Secao,
  SecaoPdf,
};
