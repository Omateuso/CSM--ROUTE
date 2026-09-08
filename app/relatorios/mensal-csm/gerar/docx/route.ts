import { createClient } from "@/lib/supabase/server";
import { buscarServicosValidados, resumoDoPeriodo } from "@/lib/relatorio-mensal/consulta";
import { montarDocxRelatorio } from "@/lib/relatorio-mensal/docx";
import { lerFiltro } from "@/lib/relatorio-mensal/request";

// Route Handler Node (não Edge) — `docx` + `sharp` são libs de Node puras, sem
// browser headless, então rodam numa function comum. Devolve download direto
// (Content-Disposition: attachment), sem diálogo nenhum.
export const dynamic = "force-dynamic";
export const maxDuration = 300; // ~292 serviços × ~900 imagens; ignorado no dev, respeitado onde o deploy suportar

export async function GET(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Não autenticado.", { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "gerente") return new Response("Essa exportação é exclusiva do perfil gerente.", { status: 403 });

  const { searchParams } = new URL(request.url);
  const filtro = lerFiltro(searchParams);
  const nf = (searchParams.get("nf") ?? "").trim();

  const servicos = await buscarServicosValidados(supabase, filtro);
  const resumo = resumoDoPeriodo(servicos);
  const buffer = await montarDocxRelatorio(supabase, { filtro, nf, servicos, resumo });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="relatorio-mensal-csm-${filtro.inicio.slice(0, 7)}.docx"`,
      "Content-Length": String(buffer.length),
    },
  });
}
