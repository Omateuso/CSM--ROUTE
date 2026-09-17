import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FOCUS_RING } from "@/lib/ui/styles";
import { RtHistoricoLista } from "./rt-historico-lista";
import type { RtOpcao } from "./rt-picker";

export const metadata = {
  title: "Relatório de RT — CSM ROUTE",
};

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function RelatorioRtIndexPage() {
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

  const [{ data: rtsRaw }, { data: contagemRaw }] = await Promise.all([
    supabase
      .from("rts")
      .select("id, codigo, nome, endereco, bairro, caps(nome)")
      .eq("ativo", true)
      .order("codigo", { ascending: true }),
    supabase.from("relatorios_rt").select("rt_id"),
  ]);

  const rts: RtOpcao[] = (rtsRaw ?? []).map((rt) => ({
    id: rt.id as string,
    codigo: rt.codigo as string,
    nome: rt.nome as string,
    endereco: rt.endereco as string,
    bairro: rt.bairro as string,
    capsNome: unwrapOne(rt.caps)?.nome ?? "—",
  }));

  const contagemPorRt: Record<string, number> = {};
  for (const row of contagemRaw ?? []) {
    const rtId = row.rt_id as string;
    contagemPorRt[rtId] = (contagemPorRt[rtId] ?? 0) + 1;
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-text-tertiary">Relatórios · perfil gerente</p>
          <h1 className="mt-1 text-2xl font-semibold text-text-primary">Relatório de RT</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-text-secondary">
            Documenta uma ocorrência identificada numa residência terapêutica — em visita, por relato de técnico ou
            qualquer outra via — e gera um documento técnico para encaminhamento ao IGEDES. Não é um chamado.
          </p>
        </div>
        <Link
          href="/relatorios/rt/novo"
          className={`rounded-[var(--radius-sm)] bg-accent px-4 py-2 text-sm font-medium whitespace-nowrap text-white transition-colors hover:bg-accent-hover ${FOCUS_RING}`}
        >
          + Novo relatório
        </Link>
      </header>

      <RtHistoricoLista rts={rts} contagemPorRt={contagemPorRt} />
    </div>
  );
}
