import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FOCUS_RING } from "@/lib/ui/styles";
import { formatarData } from "@/lib/relatorio-mensal/periodo";
import { buscarChamadosDaRt, type ChamadoDaRt } from "../actions";
import type { RtOpcao } from "../rt-picker";
import { RelatorioRtForm } from "./relatorio-rt-form";

export const metadata = {
  title: "Novo relatório de RT — CSM ROUTE",
};

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function NovoRelatorioRtPage(props: PageProps<"/relatorios/rt/novo">) {
  const searchParams = await props.searchParams;
  const rtIdQuery = typeof searchParams.rt === "string" ? searchParams.rt : null;
  const rascunhoId = typeof searchParams.rascunho === "string" ? searchParams.rascunho : null;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role, nome").eq("id", user.id).single();
  if (profile?.role !== "gerente") {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-text-secondary">Essa página é exclusiva do perfil gerente.</p>
      </div>
    );
  }

  const { data: rtsRaw } = await supabase
    .from("rts")
    .select("id, codigo, nome, endereco, bairro, caps(nome)")
    .eq("ativo", true)
    .order("codigo", { ascending: true });

  const rts: RtOpcao[] = (rtsRaw ?? []).map((rt) => ({
    id: rt.id as string,
    codigo: rt.codigo as string,
    nome: rt.nome as string,
    endereco: rt.endereco as string,
    bairro: rt.bairro as string,
    capsNome: unwrapOne(rt.caps)?.nome ?? "—",
  }));

  let rtInicial: RtOpcao | null = null;
  let chamadosDaRtInicial: ChamadoDaRt[] = [];
  let relatorioExistente: {
    id: string;
    assunto: string;
    relatoTecnico: string;
    encaminhamento: string;
    chamadoId: string | null;
  } | null = null;
  let fotosExistentes: { id: string; url: string | null; legenda: string | null }[] = [];

  if (rascunhoId) {
    const { data: relatorioRaw } = await supabase
      .from("relatorios_rt")
      .select("id, rt_id, chamado_id, assunto, relato_tecnico, encaminhamento, status, rts(id, codigo, nome, endereco, bairro, caps(nome))")
      .eq("id", rascunhoId)
      .maybeSingle();

    if (!relatorioRaw) {
      return (
        <div className="mx-auto w-full max-w-3xl px-6 py-12">
          <Link href="/relatorios/rt" className={`text-sm font-medium text-accent hover:text-accent-hover ${FOCUS_RING}`}>
            ← Relatório de RT
          </Link>
          <p className="mt-6 text-sm text-text-secondary">Relatório não encontrado.</p>
        </div>
      );
    }

    // Achado da revisão de design: um link/aba antiga pode apontar pra um
    // relatório já finalizado — a RLS já recusaria qualquer UPDATE (a linha
    // não é mais 'rascunho'), mas é melhor nem oferecer o formulário do que
    // deixar o usuário preencher algo que vai falhar ao salvar.
    if (relatorioRaw.status === "finalizado") {
      return (
        <div className="mx-auto w-full max-w-3xl px-6 py-12">
          <Link href="/relatorios/rt" className={`text-sm font-medium text-accent hover:text-accent-hover ${FOCUS_RING}`}>
            ← Relatório de RT
          </Link>
          <p className="mt-6 text-sm text-text-secondary">
            Esse relatório já foi gerado e não pode mais ser editado. Abra o histórico da RT pra baixar o documento.
          </p>
          <Link
            href={`/relatorios/rt/${relatorioRaw.rt_id}`}
            className={`mt-3 inline-block text-sm font-medium text-accent hover:text-accent-hover ${FOCUS_RING}`}
          >
            Ver histórico da RT →
          </Link>
        </div>
      );
    }

    const rt = unwrapOne(relatorioRaw.rts);
    rtInicial = rt
      ? {
          id: rt.id as string,
          codigo: rt.codigo as string,
          nome: rt.nome as string,
          endereco: rt.endereco as string,
          bairro: rt.bairro as string,
          capsNome: unwrapOne(rt.caps)?.nome ?? "—",
        }
      : null;

    relatorioExistente = {
      id: relatorioRaw.id as string,
      assunto: (relatorioRaw.assunto as string | null) ?? "",
      relatoTecnico: (relatorioRaw.relato_tecnico as string | null) ?? "",
      encaminhamento: (relatorioRaw.encaminhamento as string | null) ?? "",
      chamadoId: (relatorioRaw.chamado_id as string | null) ?? null,
    };

    const [chamadosDaRt, { data: fotosRaw }] = await Promise.all([
      rtInicial ? buscarChamadosDaRt(rtInicial.id) : Promise.resolve([]),
      supabase
        .from("relatorios_rt_fotos")
        .select("id, storage_path, legenda")
        .eq("relatorio_id", relatorioRaw.id as string)
        .order("ordem", { ascending: true }),
    ]);
    chamadosDaRtInicial = chamadosDaRt;

    const caminhos = (fotosRaw ?? []).map((f) => f.storage_path as string);
    const urlPorCaminho = new Map<string, string>();
    if (caminhos.length > 0) {
      const { data: assinadas } = await supabase.storage.from("relatorios-rt").createSignedUrls(caminhos, 3600);
      for (const item of assinadas ?? []) {
        if (item.signedUrl) urlPorCaminho.set(item.path ?? "", item.signedUrl);
      }
    }
    fotosExistentes = (fotosRaw ?? []).map((f) => ({
      id: f.id as string,
      url: urlPorCaminho.get(f.storage_path as string) ?? null,
      legenda: (f.legenda as string | null) ?? null,
    }));
  } else if (rtIdQuery) {
    rtInicial = rts.find((rt) => rt.id === rtIdQuery) ?? null;
    if (rtInicial) chamadosDaRtInicial = await buscarChamadosDaRt(rtInicial.id);
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <Link href="/relatorios/rt" className={`text-sm font-medium text-accent hover:text-accent-hover ${FOCUS_RING}`}>
        ← Relatório de RT
      </Link>

      <header className="mt-4 mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">
          {relatorioExistente ? "Continuar relatório" : "Novo relatório de RT"}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          Documenta uma ocorrência identificada na RT — não é um chamado. Salve como rascunho pra continuar depois,
          ou gere o documento quando estiver pronto.
        </p>
      </header>

      <RelatorioRtForm
        key={relatorioExistente?.id ?? "novo"}
        rts={rts}
        rtInicial={rtInicial}
        chamadosDaRtInicial={chamadosDaRtInicial}
        relatorioExistente={relatorioExistente}
        fotosExistentes={fotosExistentes}
        responsavelNome={profile?.nome ?? "—"}
        hojeFormatado={formatarData(new Date().toISOString())}
      />
    </div>
  );
}
