import { createClient } from "@/lib/supabase/server";
import { buscarServicosValidados } from "@/lib/relatorio-mensal/consulta";
import { montarXlsxAnexo1 } from "@/lib/relatorio-mensal/xlsx";
import { lerFiltro } from "@/lib/relatorio-mensal/request";

export const dynamic = "force-dynamic";

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

  const servicos = await buscarServicosValidados(supabase, filtro);
  const buffer = await montarXlsxAnexo1(servicos);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="anexo1-csm-${filtro.inicio.slice(0, 7)}.xlsx"`,
      "Content-Length": String(buffer.length),
    },
  });
}
