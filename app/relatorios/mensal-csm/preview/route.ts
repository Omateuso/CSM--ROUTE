import { createClient } from "@/lib/supabase/server";
import { alertasDoPeriodo, buscarServicosValidados, resumoDoPeriodo } from "@/lib/relatorio-mensal/consulta";
import { lerFiltro } from "@/lib/relatorio-mensal/request";

// Prévia leve consumida pela tela quando o gerente muda mês/filtros — só
// contagens, nenhuma imagem baixada. Alertas avisam, não bloqueiam a geração.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Não autenticado.", { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "gerente") return new Response("Exclusivo do perfil gerente.", { status: 403 });

  const filtro = lerFiltro(new URL(request.url).searchParams);
  const servicos = await buscarServicosValidados(supabase, filtro);

  return Response.json({
    periodo: { inicio: filtro.inicio, fim: filtro.fim },
    resumo: resumoDoPeriodo(servicos),
    alertas: alertasDoPeriodo(servicos),
  });
}
