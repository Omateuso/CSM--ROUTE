import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RelatorioManager, type LinhaRelatorio } from "./relatorio-manager";
import { GerarRelatorioButton } from "./gerador-modal";

export default async function RelatorioPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "gestao") {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-text-secondary">Essa página é exclusiva do perfil gestão.</p>
      </div>
    );
  }

  // vw_relatorio_diario (migration 0001, corrigida na 0021 pra respeitar
  // RLS de verdade) — uma linha por combinação data+região que já teve
  // rota confirmada. "total_planejados" é o total de serviços gerados
  // naquele dia/região (não só os que continuam com status 'planejado' —
  // esse é o "total_nao_iniciados"), nome mantido igual à view.
  const { data: linhasRaw, error } = await supabase
    .from("vw_relatorio_diario")
    .select("data, regiao_id, regiao_nome, total_planejados, total_nao_iniciados, total_em_execucao, total_concluidos")
    .order("data", { ascending: false })
    .order("regiao_nome", { ascending: true });

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-danger">Não foi possível carregar o relatório ({error.message}).</p>
      </div>
    );
  }

  const linhas: LinhaRelatorio[] = (linhasRaw ?? []).map((l) => ({
    data: l.data as string,
    regiaoId: l.regiao_id as string,
    regiaoNome: l.regiao_nome as string,
    totalDoDia: l.total_planejados as number,
    naoIniciados: l.total_nao_iniciados as number,
    emExecucao: l.total_em_execucao as number,
    concluidos: l.total_concluidos as number,
  }));

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-7 sm:px-6 sm:py-10">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-text-tertiary">Visão geral</p>
          <h1 className="mt-1 text-2xl font-semibold text-text-primary">Relatório diário</h1>
          <p className="mt-2 text-sm leading-relaxed text-text-secondary">
            Operação do dia por região, a partir das rotas confirmadas.
          </p>
        </div>
        <GerarRelatorioButton />
      </header>

      <RelatorioManager linhas={linhas} />
    </div>
  );
}
