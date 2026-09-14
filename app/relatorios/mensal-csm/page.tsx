import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  alertasDoPeriodo,
  buscarServicosValidados,
  resumoDoPeriodo,
} from "@/lib/relatorio-mensal/consulta";
import { mesAtual, mesFechadoAnterior, mesParaPeriodo } from "@/lib/relatorio-mensal/periodo";
import { MensalCsmManager } from "./mensal-csm-manager";

export const metadata = {
  title: "Relatório mensal CSM — IGEDES CSM ROUTE",
};

export default async function RelatorioMensalCsmPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "gerente") {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-text-secondary">Essa página é exclusiva do perfil gerente.</p>
      </div>
    );
  }

  const mesInicial = mesFechadoAnterior();
  const periodoInicial = mesParaPeriodo(mesInicial);

  const [{ data: capsRaw }, { data: regioesRaw }, servicosIniciais] = await Promise.all([
    supabase.from("caps").select("id, nome").order("nome"),
    supabase.from("regioes").select("id, nome").order("nome"),
    buscarServicosValidados(supabase, { ...periodoInicial, capsId: null, regiaoId: null }),
  ]);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <header className="mb-6">
        <p className="font-mono text-xs uppercase tracking-wider text-text-tertiary">Exportação · perfil gerente</p>
        <h1 className="mt-1 text-2xl font-semibold text-text-primary">Relatório mensal CSM</h1>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          Gera o pacote entregue ao IGEDES: a planilha <strong>ANEXO 1</strong> (.xlsx) e o documento com uma página por
          serviço (.docx), a partir dos serviços <strong>validados</strong> no mês. Substitui a montagem manual da
          planilha + PowerPoint.
        </p>
      </header>

      <MensalCsmManager
        mesInicial={mesInicial}
        mesMaximo={mesAtual()}
        previewInicial={{
          resumo: resumoDoPeriodo(servicosIniciais),
          alertas: alertasDoPeriodo(servicosIniciais),
        }}
        caps={(capsRaw ?? []).map((c) => ({ id: c.id as string, nome: c.nome as string }))}
        regioes={(regioesRaw ?? []).map((r) => ({ id: r.id as string, nome: r.nome as string }))}
      />
    </div>
  );
}
