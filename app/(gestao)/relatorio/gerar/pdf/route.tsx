import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { buscarBloco, CATALOGO_BLOCOS } from "@/lib/relatorio/catalogo";
import type { BlocoId, Periodo } from "@/lib/relatorio/types";
import { DocumentoRelatorio } from "@/lib/relatorio/pdf/documento-relatorio";

// Pedido do usuário (27/08/2026): "Imprimir/Salvar como PDF" sempre abria
// o diálogo de impressão do navegador — window.print() nunca pula essa
// etapa, é uma restrição do próprio navegador, não dá pra contornar via
// código. Essa rota gera o PDF de verdade no servidor (react-pdf, texto
// real/selecionável — não é um "print to PDF" do navegador) e devolve
// pra download direto, sem diálogo nenhum. Roda em Node (não Edge, padrão
// deste projeto) — react-pdf não é headless browser (sem Chromium/binário
// pesado), então não reabre a preocupação de memória/cold-start que já
// tinha descartado Playwright/Puppeteer pra essa funcionalidade.
function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function ehBlocoId(valor: string): valor is BlocoId {
  return CATALOGO_BLOCOS.some((b) => b.definicao.id === valor);
}

function formatarPeriodo(periodo: Periodo): string {
  const f = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  return `${f.format(new Date(`${periodo.inicio}T00:00:00`))} a ${f.format(new Date(`${periodo.fim}T00:00:00`))}`;
}

export async function GET(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Não autenticado.", { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "gestao") return new Response("Essa página é exclusiva do perfil gestão.", { status: 403 });

  const { searchParams } = new URL(request.url);
  const idsSelecionados = (searchParams.get("blocos") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(ehBlocoId);

  if (idsSelecionados.length === 0) return new Response("Nenhum bloco selecionado.", { status: 400 });

  const periodo: Periodo = {
    inicio: searchParams.get("inicio") ?? hojeISO(),
    fim: searchParams.get("fim") ?? hojeISO(),
  };

  const blocosSelecionados = idsSelecionados.map((id) => buscarBloco(id)).filter((b) => b !== undefined);

  const resultados = await Promise.all(
    blocosSelecionados.map(async (bloco) => ({
      bloco,
      dados: await bloco.buscar(supabase, periodo),
    })),
  );

  const frasesResumo = resultados.map(({ bloco, dados }) => bloco.resumoFrase(dados)).filter((f): f is string => !!f);
  const temBlocoPeriodo = blocosSelecionados.some((b) => b.definicao.grupo === "periodo");

  const geradoEm = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

  const buffer = await renderToBuffer(
    <DocumentoRelatorio
      geradoEm={geradoEm}
      periodoTexto={temBlocoPeriodo ? ` · Período: ${formatarPeriodo(periodo)}` : ""}
      resumo={frasesResumo.join(" ")}
    >
      {resultados.map(({ bloco, dados }) => {
        const SecaoPdf = bloco.SecaoPdf;
        return <SecaoPdf key={bloco.definicao.id} dados={dados} />;
      })}
    </DocumentoRelatorio>,
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="relatorio-csm-route-${hojeISO()}.pdf"`,
      "Content-Length": String(buffer.length),
    },
  });
}
