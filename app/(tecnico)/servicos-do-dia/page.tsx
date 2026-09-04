import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/app/logout-button";
import { PrioridadeBadge, type Prioridade } from "@/app/chamados/prioridade-badge";
import { SlaBadge } from "@/app/chamados/sla-badge";
import { StatusServicoBadge, type StatusServico } from "../status-servico-badge";

const formatoDataCurta = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });

// Mesma situação das demais telas: sem Database types gerados ainda, embed
// aninhado fica ambíguo pro TypeScript (array vs objeto único), embora em
// runtime seja sempre objeto único (FK to-one).
function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function ServicosDoDiaPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("nome, role").eq("id", user.id).single();
  if (profile?.role !== "tecnico") {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-text-secondary">Essa página é exclusiva do perfil técnico.</p>
      </div>
    );
  }

  const hoje = new Date().toISOString().slice(0, 10);

  const { data: servicosRaw, error: servicosError } = await supabase
    .from("servicos")
    .select(
      "id, status, rota_id, rt_id, rotas!inner(data), chamados(assunto, prioridade, sla_prazo, status, tomticket_id, criado_em), rts(codigo, nome, endereco)",
    )
    .eq("tecnico_id", user.id)
    .eq("rotas.data", hoje)
    // Migration 0025: recusar/pendência de material podem cancelar um
    // serviço de HOJE (diferente de reagendar, que só atuava em rota já
    // passada) — cancelado não tem mais ação nenhuma pro técnico, não
    // precisa aparecer na lista.
    .neq("status", "cancelado");

  if (servicosError) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-danger">Não foi possível carregar seus serviços ({servicosError.message}).</p>
      </div>
    );
  }

  const rotaIds = [...new Set((servicosRaw ?? []).map((s) => s.rota_id as string))];
  const { data: rotaRtsRaw } =
    rotaIds.length > 0
      ? await supabase.from("rota_rts").select("rota_id, rt_id, ordem").in("rota_id", rotaIds)
      : { data: [] as { rota_id: string; rt_id: string; ordem: number }[] };
  const ordemPorParada = new Map(
    (rotaRtsRaw ?? []).map((r) => [`${r.rota_id}-${r.rt_id}`, r.ordem as number]),
  );

  const servicos = (servicosRaw ?? [])
    .map((s) => {
      const chamado = unwrapOne(s.chamados);
      const rt = unwrapOne(s.rts);
      return {
        id: s.id as string,
        status: s.status as StatusServico,
        ordem: ordemPorParada.get(`${s.rota_id}-${s.rt_id}`) ?? 999,
        rtCodigo: rt?.codigo as string,
        rtNome: rt?.nome as string,
        rtEndereco: rt?.endereco as string,
        assunto: chamado?.assunto as string,
        protocolo: (chamado?.tomticket_id as string | null) ?? null,
        criadoEm: chamado?.criado_em as string,
        prioridade: chamado?.prioridade as Prioridade,
        slaPrazo: (chamado?.sla_prazo as string | null) ?? null,
        chamadoStatus: chamado?.status as "aberto" | "em_andamento" | "finalizado" | "cancelado",
      };
    })
    .sort((a, b) => a.ordem - b.ordem);

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-start justify-between gap-3 border-b border-border px-4 pt-8 pb-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-text-tertiary">
            {new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long" }).format(new Date())}
          </p>
          <h1 className="mt-1 text-xl font-semibold text-text-primary">Meus serviços de hoje</h1>
          <p className="mt-1 text-sm text-text-secondary">Olá, {profile?.nome ?? "técnico"}</p>
        </div>
        <LogoutButton />
      </header>

      <div className="flex-1 px-4 py-4">
        {servicos.length === 0 ? (
          <p className="mt-8 text-center text-sm text-text-tertiary">
            Nenhum serviço planejado pra você hoje.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {servicos.map((s, indice) => (
              <li key={s.id}>
                <Link
                  href={`/servico/${s.id}`}
                  className="block rounded-[var(--radius-md)] border border-border bg-surface p-4 transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-white">
                      {indice + 1}
                    </span>
                    <span className="font-mono text-xs text-text-secondary">{s.rtCodigo}</span>
                    {s.protocolo && (
                      <span className="font-mono text-xs text-text-tertiary">#{s.protocolo}</span>
                    )}
                    {s.criadoEm && (
                      <span className="text-xs text-text-tertiary">
                        criado em {formatoDataCurta.format(new Date(s.criadoEm))}
                      </span>
                    )}
                    <span className="ml-auto">
                      <StatusServicoBadge status={s.status} />
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-text-primary">{s.assunto}</p>
                  <p className="mt-0.5 truncate text-xs text-text-tertiary">{s.rtEndereco}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <PrioridadeBadge prioridade={s.prioridade} />
                    <SlaBadge slaPrazo={s.slaPrazo} status={s.chamadoStatus} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
