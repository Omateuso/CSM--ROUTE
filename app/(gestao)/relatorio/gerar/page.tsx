import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buscarBloco, CATALOGO_BLOCOS } from "@/lib/relatorio/catalogo";
import type { BlocoId, Periodo } from "@/lib/relatorio/types";
import { ImprimirButton } from "./imprimir-button";
import styles from "@/lib/relatorio/relatorio-print.module.css";

export const metadata = {
  title: "Relatório — IGEDES CSM ROUTE",
};

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function ehBlocoId(valor: string): valor is BlocoId {
  return CATALOGO_BLOCOS.some((b) => b.definicao.id === valor);
}

export default async function GerarRelatorioPage(props: PageProps<"/relatorio/gerar">) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role, nome").eq("id", user.id).single();
  if (profile?.role !== "gestao") {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-text-secondary">Essa página é exclusiva do perfil gestão.</p>
      </div>
    );
  }

  const searchParams = await props.searchParams;
  const blocosParam = typeof searchParams.blocos === "string" ? searchParams.blocos : "";
  const idsSelecionados = blocosParam
    .split(",")
    .map((s) => s.trim())
    .filter(ehBlocoId);

  if (idsSelecionados.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-text-secondary">
          Nenhum bloco selecionado. Volte para{" "}
          <a href="/relatorio" className="text-accent underline">
            Relatório
          </a>{" "}
          e use &ldquo;Gerar relatório&rdquo;.
        </p>
      </div>
    );
  }

  const inicioParam = typeof searchParams.inicio === "string" ? searchParams.inicio : hojeISO();
  const fimParam = typeof searchParams.fim === "string" ? searchParams.fim : hojeISO();
  const periodo: Periodo = { inicio: inicioParam, fim: fimParam };

  const blocosSelecionados = idsSelecionados.map((id) => buscarBloco(id)).filter((b) => b !== undefined);

  const resultados = await Promise.all(
    blocosSelecionados.map(async (bloco) => ({
      bloco,
      dados: await bloco.buscar(supabase, periodo),
    })),
  );

  const frasesResumo = resultados.map(({ bloco, dados }) => bloco.resumoFrase(dados)).filter((f): f is string => !!f);

  const geradoEm = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

  const temBlocoPeriodo = blocosSelecionados.some((b) => b.definicao.grupo === "periodo");

  return (
    <div className={styles.shell}>
      <ImprimirButton />

      <div className={styles.paginaScreen}>
        {/* <table> com thead/tfoot — não position:fixed (ver comentário no
            topo do relatorio-print.module.css: testado com PDF real,
            fixed fica em posição inconsistente entre páginas; thead/tfoot
            é o mecanismo nativo que realmente repete em toda página
            impressa). A marca d'água vive DENTRO do thead (que repete),
            não solta. */}
        {/* role="presentation": tabela usada só pela técnica de paginação
            (thead/tfoot repetindo por página), não é dado tabular — sem
            isso, leitor de tela anunciaria semântica de tabela de dados
            sem sentido nenhum aqui. */}
        <table role="presentation" className={styles.folha}>
          <thead>
            <tr>
              <td className={styles.cabecalhoCelula}>
                {/* eslint-disable-next-line @next/next/no-img-element -- next/image adiciona lazy-loading que pode não estar pronto quando window.print() dispara; aqui a imagem precisa existir de verdade na hora de imprimir. */}
                <img src="/relatorio/marca-dagua-igedes.png" alt="" aria-hidden="true" className={styles.marcaDagua} />
                <div className={styles.cabecalho}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- mesmo motivo do watermark acima. */}
                  <img
                    src="/relatorio/logo-igedes-completo.png"
                    alt="IGEDES — Instituto de Gestão e Desenvolvimento"
                    className={styles.logo}
                  />
                  <div className={styles.tituloDocumento}>
                    <h1>Relatório de operação — CSM ROUTE</h1>
                    <p>
                      Gerado em {geradoEm}
                      {temBlocoPeriodo ? ` · Período: ${formatarPeriodo(periodo)}` : ""}
                    </p>
                  </div>
                </div>
              </td>
            </tr>
          </thead>
          <tfoot>
            <tr>
              <td className={styles.rodapeCelula}>
                <div className={styles.rodapeBarra}>
                  IGEDES - Instituto de Gestão e Desenvolvimento | CNPJ: 05.696.218/0001-46
                </div>
                <div className={styles.rodapeTexto}>
                  Avenida das Américas, 3500 - Bloco 7, Sl 704 - Barra da Tijuca, Rio de Janeiro-RJ | CEP: 22640-102
                  <br />
                  Tel. (21) 3598-2371 / 3598-2372 | igedes.org.br
                </div>
              </td>
            </tr>
          </tfoot>
          <tbody>
            <tr>
              <td className={styles.mioloCelula}>
                {frasesResumo.length > 0 && (
                  <p className={styles.resumoExecutivo}>
                    <strong>Resumo executivo. </strong>
                    {frasesResumo.join(" ")}
                  </p>
                )}

                {resultados.map(({ bloco, dados }) => {
                  const Secao = bloco.Secao;
                  return <Secao key={bloco.definicao.id} dados={dados} />;
                })}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatarPeriodo(periodo: Periodo): string {
  const f = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  return `${f.format(new Date(`${periodo.inicio}T00:00:00`))} a ${f.format(new Date(`${periodo.fim}T00:00:00`))}`;
}
