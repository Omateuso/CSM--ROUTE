import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FOCUS_RING } from "@/lib/ui/styles";
import { StatusBadge } from "../status-badge";

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

const fmtData = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
function data(d: string | null): string {
  return d ? fmtData.format(new Date(`${d}T00:00:00`)) : "hoje";
}

type PeriodoEndereco = {
  endereco_id: string;
  endereco: string;
  bairro: string;
  regiao_nome: string;
  vigente_desde: string;
  vigente_ate: string | null;
  atual: boolean;
  motivo: string | null;
  chamados_criados: number;
  chamados_finalizados: number;
  chamados_abertos: number;
};

export default async function RtDetalhePage({ params }: PageProps<"/rts/[id]">) {
  const { id } = await params;
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

  const [{ data: rtRaw }, { data: periodosRaw, error: periodosError }] = await Promise.all([
    supabase
      .from("rts")
      .select("id, codigo, nome, ativo, endereco, bairro, regioes(nome, zonas(nome)), caps(nome)")
      .eq("id", id)
      .maybeSingle(),
    supabase.rpc("fn_rt_enderecos_resumo", { p_rt_id: id }),
  ]);

  if (!rtRaw) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-12">
        <Link href="/rts" className={`text-sm font-medium text-accent hover:text-accent-hover ${FOCUS_RING}`}>
          ← RTs
        </Link>
        <p className="mt-6 text-sm text-text-secondary">RT não encontrada.</p>
      </div>
    );
  }

  const regiao = unwrapOne(rtRaw.regioes);
  const zonaNome = unwrapOne(regiao?.zonas)?.nome ?? "—";
  const capsNome = unwrapOne(rtRaw.caps)?.nome ?? "—";

  const periodos = (periodosRaw ?? []) as PeriodoEndereco[];
  const atual = periodos.find((p) => p.atual) ?? periodos[0] ?? null;
  const anteriores = periodos.filter((p) => !p.atual);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <Link href="/rts" className={`text-sm font-medium text-accent hover:text-accent-hover ${FOCUS_RING}`}>
        ← RTs
      </Link>

      <header className="mt-4 flex flex-wrap items-baseline gap-3 border-b border-border pb-4">
        <h1 className="font-mono text-2xl font-semibold text-text-primary">{rtRaw.codigo as string}</h1>
        <span className="text-lg text-text-secondary">{rtRaw.nome as string}</span>
        <StatusBadge ativo={rtRaw.ativo as boolean} />
      </header>

      <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-text-tertiary">CAPS</dt>
          <dd className="text-text-primary">{capsNome}</dd>
        </div>
        <div>
          <dt className="text-xs text-text-tertiary">Zona</dt>
          <dd className="text-text-primary">{zonaNome}</dd>
        </div>
        <div>
          <dt className="text-xs text-text-tertiary">Região</dt>
          <dd className="text-text-primary">{regiao?.nome ?? "—"}</dd>
        </div>
      </dl>

      {periodosError ? (
        <p className="mt-8 text-sm text-danger">
          Não foi possível carregar o histórico de endereços ({periodosError.message}).
        </p>
      ) : (
        <>
          <section className="mt-8">
            <p className="text-xs font-medium tracking-wide text-text-tertiary uppercase">Endereço atual</p>
            {atual ? (
              <div className="mt-2 rounded-[var(--radius-md)] border border-border-strong bg-surface p-4">
                <p className="text-base font-medium text-text-primary">{atual.endereco}</p>
                <p className="text-sm text-text-tertiary">
                  {atual.bairro} · {atual.regiao_nome}
                </p>
                <p className="mt-1 text-xs text-text-tertiary">Desde {data(atual.vigente_desde)}</p>
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  <Contagem rotulo="Chamados criados" valor={atual.chamados_criados} />
                  <Contagem rotulo="Finalizados" valor={atual.chamados_finalizados} />
                  <Contagem rotulo="Em aberto" valor={atual.chamados_abertos} />
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-text-tertiary">Sem endereço registrado.</p>
            )}
          </section>

          <section className="mt-8">
            <p className="text-xs font-medium tracking-wide text-text-tertiary uppercase">
              Histórico de endereços
            </p>
            {anteriores.length === 0 ? (
              <p className="mt-2 text-sm text-text-tertiary">
                Sem trocas de endereço registradas — a RT sempre esteve no endereço atual.
              </p>
            ) : (
              <ol className="mt-2 flex flex-col gap-2">
                {anteriores.map((p) => (
                  <li key={p.endereco_id} className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
                    <p className="text-sm font-medium text-text-primary">{p.endereco}</p>
                    <p className="text-sm text-text-tertiary">
                      {p.bairro} · {p.regiao_nome}
                    </p>
                    <p className="mt-1 text-xs text-text-tertiary">
                      Período: {data(p.vigente_desde)} → {data(p.vigente_ate)}
                      {p.motivo ? ` · ${p.motivo}` : ""}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                      <Contagem rotulo="Chamados criados" valor={p.chamados_criados} />
                      <Contagem rotulo="Finalizados" valor={p.chamados_finalizados} />
                      <Contagem rotulo="Em aberto" valor={p.chamados_abertos} />
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <p className="mt-6 text-xs text-text-tertiary">
            Cada chamado é contado no endereço que estava vigente quando foi criado — os chamados do endereço
            anterior nunca se misturam com os do atual.
          </p>
        </>
      )}
    </div>
  );
}

function Contagem({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <span>
      <span className="tabular-nums font-semibold text-text-primary">{valor}</span>{" "}
      <span className="text-text-tertiary">{rotulo.toLowerCase()}</span>
    </span>
  );
}
