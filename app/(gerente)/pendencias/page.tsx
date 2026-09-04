import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { tomticketSearchUrl } from "@/lib/tomticket";
import { FOCUS_RING } from "@/lib/ui/styles";
import { PENDENCIA_CATEGORIA_LABEL, type PendenciaCategoria } from "@/lib/ui/pendencia-categoria";

// Página própria desde 22/08/2026 (pedido do usuário) — antes era um modal
// dentro de /validacao. Mesma consulta que vivia lá: `historico` com
// evento `servico_pendente` (migration 0026), filtrando os que já foram
// recapturados numa rota nova (resolvem sozinhos).
function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function unwrapMany<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

const formatoDataHora = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function EvidenciaThumb({ url, label }: { url: string | null; label: string }) {
  if (!url) {
    return <p className="text-xs text-text-tertiary">{label}: não anexada.</p>;
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={`flex flex-col items-start gap-1 ${FOCUS_RING}`}>
      <span className="text-xs font-medium text-text-secondary">{label}</span>
      {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada do Storage, não é imagem otimizável estaticamente */}
      <img
        src={url}
        alt={label}
        className="h-28 w-28 rounded-[var(--radius-sm)] border border-border object-cover transition-opacity hover:opacity-80"
      />
    </a>
  );
}

export default async function PendenciasPage() {
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

  const { data: pendenciasRaw } = await supabase
    .from("historico")
    .select(
      "id, chamado_id, categoria, descricao, criado_em, criado_por:criado_por(nome), chamados(assunto, tomticket_id, rts(codigo, nome)), servicos(evidencias(tipo, momento, storage_path))",
    )
    .eq("evento", "servico_pendente")
    .order("criado_em", { ascending: false });

  const chamadoIdsPendencia = [...new Set((pendenciasRaw ?? []).map((p) => p.chamado_id as string))];
  const chamadosJaRecapturados = new Set<string>();
  if (chamadoIdsPendencia.length > 0) {
    const { data: servicosAtivosRaw } = await supabase
      .from("servicos")
      .select("chamado_id")
      .in("chamado_id", chamadoIdsPendencia)
      .neq("status", "cancelado");
    for (const s of servicosAtivosRaw ?? []) chamadosJaRecapturados.add(s.chamado_id as string);
  }

  const pendenciasFiltradas = (pendenciasRaw ?? []).filter(
    (p) => !chamadosJaRecapturados.has(p.chamado_id as string),
  );

  const caminhosPendencia = pendenciasFiltradas.flatMap((p) =>
    unwrapMany(unwrapOne(p.servicos)?.evidencias).map((e) => e.storage_path as string),
  );
  const urlPorCaminho = new Map<string, string>();
  if (caminhosPendencia.length > 0) {
    const { data: assinadas } = await supabase.storage.from("evidencias").createSignedUrls(caminhosPendencia, 3600);
    for (const item of assinadas ?? []) {
      if (item.signedUrl) urlPorCaminho.set(item.path ?? "", item.signedUrl);
    }
  }

  const pendencias = pendenciasFiltradas.map((p) => {
    const chamado = unwrapOne(p.chamados);
    const rt = chamado ? unwrapOne(chamado.rts) : null;
    const evidenciasServico = unwrapMany(unwrapOne(p.servicos)?.evidencias);
    const fotoParcial = evidenciasServico.find((e) => e.tipo === "foto" && e.momento === "parcial");
    const os = evidenciasServico.find((e) => e.tipo === "os");
    return {
      historicoId: p.id as string,
      categoria: (p.categoria as string | null) ?? null,
      descricao: p.descricao as string | null,
      criadoEm: p.criado_em as string,
      tecnicoNome: unwrapOne(p.criado_por)?.nome ?? "—",
      rtCodigo: rt?.codigo ?? "—",
      rtNome: rt?.nome ?? "—",
      chamadoAssunto: chamado?.assunto ?? "—",
      tomticketId: (chamado?.tomticket_id as string | null) ?? null,
      fotoParcialUrl: fotoParcial ? (urlPorCaminho.get(fotoParcial.storage_path as string) ?? null) : null,
      osUrl: os ? (urlPorCaminho.get(os.storage_path as string) ?? null) : null,
    };
  });

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <header className="mb-6">
        <p className="font-mono text-xs uppercase tracking-wider text-text-tertiary">Execução</p>
        <h1 className="mt-1 text-2xl font-semibold text-text-primary uppercase">Pendências</h1>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          Atendimento iniciado, mas não concluído — some sozinha daqui assim que o chamado entrar numa
          rota nova.
        </p>
      </header>

      {pendencias.length === 0 ? (
        <p className="rounded-[var(--radius-md)] border border-border bg-surface px-4 py-8 text-center text-sm text-text-tertiary">
          Nenhuma pendência em aberto.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {pendencias.map((p) => (
            <article key={p.historicoId} className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-text-secondary">{p.rtCodigo}</span>
                    {p.tomticketId && (
                      <span className="font-mono text-xs text-text-tertiary">#{p.tomticketId}</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm font-medium text-text-primary">{p.chamadoAssunto}</p>
                  <p className="text-xs text-text-tertiary">{p.rtNome}</p>
                </div>
                {p.tomticketId && (
                  <a
                    href={tomticketSearchUrl(p.tomticketId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`shrink-0 text-xs font-medium text-accent hover:text-accent-hover ${FOCUS_RING}`}
                  >
                    Ir para o TomTicket →
                  </a>
                )}
              </div>

              <div className="mt-3 rounded-[var(--radius-sm)] bg-surface-input p-3">
                <p className="text-xs font-semibold text-priority-alta">
                  {p.categoria
                    ? (PENDENCIA_CATEGORIA_LABEL[p.categoria as PendenciaCategoria] ?? p.categoria)
                    : "Pendência"}
                </p>
                <p className="mt-1 text-xs text-text-tertiary">
                  Reportado por <strong className="text-text-secondary">{p.tecnicoNome}</strong> em{" "}
                  {formatoDataHora.format(new Date(p.criadoEm))}
                </p>
                <p className="mt-1.5 text-sm whitespace-pre-wrap text-text-primary">
                  {p.descricao || "Sem descrição registrada."}
                </p>

                <div className="mt-3 flex flex-wrap gap-4">
                  <EvidenciaThumb url={p.fotoParcialUrl} label="Foto do parcial" />
                  <EvidenciaThumb url={p.osUrl} label="OS" />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
