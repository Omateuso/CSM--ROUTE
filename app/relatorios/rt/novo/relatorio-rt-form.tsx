"use client";

import { useActionState, useEffect, useId, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { FIELD_INPUT, FIELD_LABEL, FOCUS_RING } from "@/lib/ui/styles";
import { salvarRelatorioRt, buscarChamadosDaRt, removerFotoRelatorio, type ActionState, type ChamadoDaRt } from "../actions";
import { RtPicker, type RtOpcao } from "../rt-picker";

const ESTADO_INICIAL: ActionState = { error: null };

type FotoExistente = { id: string; url: string | null; legenda: string | null };
type Pendente = { id: string; file: File; legenda: string; previewUrl: string };

export function RelatorioRtForm({
  rts,
  rtInicial,
  chamadosDaRtInicial,
  relatorioExistente,
  fotosExistentes,
  responsavelNome,
  hojeFormatado,
}: {
  rts: RtOpcao[];
  rtInicial: RtOpcao | null;
  chamadosDaRtInicial: ChamadoDaRt[];
  relatorioExistente: {
    id: string;
    assunto: string;
    relatoTecnico: string;
    encaminhamento: string;
    chamadoId: string | null;
  } | null;
  fotosExistentes: FotoExistente[];
  responsavelNome: string;
  hojeFormatado: string;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(salvarRelatorioRt, ESTADO_INICIAL);

  const rtTravada = relatorioExistente !== null; // relatório já existe: RT não pode mais mudar
  const [rtSelecionada, setRtSelecionada] = useState<RtOpcao | null>(rtInicial);
  const [mostrarPicker, setMostrarPicker] = useState(rtInicial === null);

  const [chamados, setChamados] = useState<ChamadoDaRt[]>(chamadosDaRtInicial);
  const [chamadoId, setChamadoId] = useState<string | null>(relatorioExistente?.chamadoId ?? null);
  const [buscandoChamados, setBuscandoChamados] = useState(false);
  const [chamadoAberto, setChamadoAberto] = useState(false);

  const [assunto, setAssunto] = useState(relatorioExistente?.assunto ?? "");
  const [relatoTecnico, setRelatoTecnico] = useState(relatorioExistente?.relatoTecnico ?? "");
  const [encaminhamento, setEncaminhamento] = useState(relatorioExistente?.encaminhamento ?? "");

  const [pendentes, setPendentes] = useState<Pendente[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const escolherId = useId();

  // Sincroniza o input de arquivo escondido (é o único jeito de fazer um
  // <input type=file> carregar Files que vieram de fora de uma seleção
  // nativa do próprio input) — mesma técnica de DataTransfer já usada em
  // camera-capture-field.tsx.
  useEffect(() => {
    const input = fileInputRef.current;
    if (!input) return;
    const dt = new DataTransfer();
    for (const p of pendentes) dt.items.add(p.file);
    input.files = dt.files;
  }, [pendentes]);

  const relatorioIdRef = useRef<string | null>(relatorioExistente?.id ?? null);
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !isPending && state.error === null && state.relatorioId) {
      if (state.status === "finalizado") {
        router.push(`/relatorios/rt/${state.rtId}`);
      } else if (relatorioIdRef.current !== state.relatorioId) {
        relatorioIdRef.current = state.relatorioId;
        router.replace(`/relatorios/rt/novo?rascunho=${state.relatorioId}`, { scroll: false });
      }
      setPendentes([]);
    }
    wasPending.current = isPending;
  }, [isPending, state, router]);

  async function selecionarRt(rt: RtOpcao) {
    setRtSelecionada(rt);
    setMostrarPicker(false);
    setChamadoId(null);
    setBuscandoChamados(true);
    const encontrados = await buscarChamadosDaRt(rt.id);
    setChamados(encontrados);
    setBuscandoChamados(false);
  }

  function handleEscolherFotos(e: ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(e.target.files ?? []);
    if (arquivos.length === 0) return;
    setPendentes((prev) => [
      ...prev,
      ...arquivos.map((file) => ({ id: crypto.randomUUID(), file, legenda: "", previewUrl: URL.createObjectURL(file) })),
    ]);
    e.target.value = "";
  }

  function removerPendente(id: string) {
    setPendentes((prev) => {
      const alvo = prev.find((p) => p.id === id);
      if (alvo) URL.revokeObjectURL(alvo.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }

  function atualizarLegendaPendente(id: string, legenda: string) {
    setPendentes((prev) => prev.map((p) => (p.id === id ? { ...p, legenda } : p)));
  }

  const podeSalvar = rtSelecionada !== null && !isPending;
  const idAssunto = `${escolherId}-assunto`;
  const idRelato = `${escolherId}-relato`;
  const idEncaminhamento = `${escolherId}-encaminhamento`;

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="relatorioId" value={relatorioExistente?.id ?? ""} />
      <input type="hidden" name="rtId" value={rtSelecionada?.id ?? ""} />
      <input type="hidden" name="chamadoId" value={chamadoId ?? ""} />
      <input ref={fileInputRef} type="file" name="fotosNovas" multiple className="hidden" aria-hidden tabIndex={-1} />

      {/* 1. RT / Endereço */}
      <section>
        {mostrarPicker ? (
          <RtPicker rts={rts} onSelecionar={selecionarRt} autoFocus />
        ) : (
          rtSelecionada && (
            <div className="rounded-[var(--radius-md)] border border-border bg-surface-input p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-semibold text-text-primary">{rtSelecionada.codigo}</span>
                <span className="text-sm font-medium text-text-primary">{rtSelecionada.nome}</span>
                {!rtTravada && (
                  <button
                    type="button"
                    onClick={() => setMostrarPicker(true)}
                    className={`ml-auto text-xs font-medium text-accent hover:text-accent-hover ${FOCUS_RING}`}
                  >
                    Trocar RT
                  </button>
                )}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-text-tertiary">Endereço</dt>
                  <dd className="text-text-primary">
                    {rtSelecionada.endereco}, {rtSelecionada.bairro}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-text-tertiary">CAPS</dt>
                  <dd className="text-text-primary">{rtSelecionada.capsNome}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text-tertiary">Data</dt>
                  <dd className="text-text-primary">{hojeFormatado}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text-tertiary">Responsável</dt>
                  <dd className="text-text-primary">{responsavelNome}</dd>
                </div>
              </dl>
            </div>
          )
        )}
      </section>

      {/* 2. Chamado relacionado (opcional) — só depois da RT escolhida */}
      {rtSelecionada && (
        <section>
          <p className={FIELD_LABEL}>Chamado relacionado (opcional)</p>
          {!chamadoAberto ? (
            <div className="mt-1 flex items-center gap-3 rounded-[var(--radius-sm)] border border-border px-3 py-2 text-sm">
              <span className="text-text-secondary">
                {buscandoChamados
                  ? "Carregando chamados dessa RT..."
                  : chamadoId
                    ? (chamados.find((c) => c.id === chamadoId)?.assunto ?? "Chamado selecionado")
                    : "Nenhum"}
              </span>
              <button
                type="button"
                onClick={() => setChamadoAberto(true)}
                disabled={buscandoChamados}
                className={`ml-auto text-xs font-medium text-accent hover:text-accent-hover ${FOCUS_RING}`}
              >
                {chamadoId ? "Trocar" : "Escolher chamado"}
              </button>
            </div>
          ) : (
            <ChamadoPicker
              chamados={chamados}
              selecionadoId={chamadoId}
              onSelecionar={(id) => {
                setChamadoId(id);
                setChamadoAberto(false);
              }}
            />
          )}
        </section>
      )}

      {/* 3. Assunto */}
      <div className="flex flex-col gap-1">
        <label htmlFor={idAssunto} className={FIELD_LABEL}>
          Assunto do relatório
        </label>
        <input
          id={idAssunto}
          name="assunto"
          type="text"
          value={assunto}
          onChange={(e) => setAssunto(e.target.value)}
          placeholder="Ex.: Problema no sistema de esgoto da residência"
          className={FIELD_INPUT}
        />
      </div>

      {/* 4. Relato técnico */}
      <div className="flex flex-col gap-1">
        <label htmlFor={idRelato} className={FIELD_LABEL}>
          Relato técnico
        </label>
        <textarea
          id={idRelato}
          name="relatoTecnico"
          value={relatoTecnico}
          onChange={(e) => setRelatoTecnico(e.target.value)}
          rows={12}
          placeholder="Descreva livremente o que foi observado — pode usar parágrafos, contexto, recomendações..."
          className={`${FIELD_INPUT} resize-y leading-relaxed`}
        />
      </div>

      {/* 5. Fotos */}
      <div className="flex flex-col gap-2">
        <p className={FIELD_LABEL}>Fotos / evidências (opcional)</p>

        {fotosExistentes.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {fotosExistentes.map((f) => (
              <div key={f.id} className="flex flex-col gap-1">
                <div className="aspect-[4/3] overflow-hidden rounded-[var(--radius-sm)] border border-border bg-surface-input">
                  {f.url && (
                    // eslint-disable-next-line @next/next/no-img-element -- URL assinada de bucket privado
                    <img src={f.url} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <p className="truncate text-xs text-text-tertiary">{f.legenda || "sem legenda"}</p>
                <form action={removerFotoRelatorio.bind(null, f.id)}>
                  <button type="submit" className={`text-xs text-danger hover:underline ${FOCUS_RING}`}>
                    Remover
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}

        {pendentes.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {pendentes.map((p) => (
              <div key={p.id} className="flex flex-col gap-1">
                <div className="aspect-[4/3] overflow-hidden rounded-[var(--radius-sm)] border border-border bg-surface-input">
                  {/* eslint-disable-next-line @next/next/no-img-element -- pré-visualização local (blob:), next/image não serve blob URL */}
                  <img src={p.previewUrl} alt="" className="h-full w-full object-cover" />
                </div>
                <input
                  type="text"
                  name="legendasNovas"
                  value={p.legenda}
                  onChange={(e) => atualizarLegendaPendente(p.id, e.target.value)}
                  placeholder="Legenda (opcional)"
                  className={`${FIELD_INPUT} text-xs`}
                />
                <button
                  type="button"
                  onClick={() => removerPendente(p.id)}
                  className={`text-xs text-danger hover:underline ${FOCUS_RING}`}
                >
                  Remover
                </button>
              </div>
            ))}
          </div>
        )}

        <input id={escolherId} type="file" accept="image/*" multiple onChange={handleEscolherFotos} className="hidden" />
        <label
          htmlFor={escolherId}
          className={`w-fit cursor-pointer rounded-[var(--radius-sm)] border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-accent hover:text-text-primary ${FOCUS_RING}`}
        >
          + Adicionar fotos
        </label>
      </div>

      {/* 6. Informações complementares */}
      <div className="flex flex-col gap-1">
        <label htmlFor={idEncaminhamento} className={FIELD_LABEL}>
          Informações complementares / encaminhamento (opcional)
        </label>
        <textarea
          id={idEncaminhamento}
          name="encaminhamento"
          value={encaminhamento}
          onChange={(e) => setEncaminhamento(e.target.value)}
          rows={4}
          placeholder="O que precisa ser feito, recomendação, necessidade de autorização, acompanhamento..."
          className={`${FIELD_INPUT} resize-y leading-relaxed`}
        />
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      {!isPending && state.error === null && state.status === "rascunho" && (
        <p className="text-sm text-success">Rascunho salvo.</p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-4">
        <button
          type="submit"
          name="acao"
          value="rascunho"
          disabled={!podeSalvar}
          className={`rounded-[var(--radius-sm)] border border-border px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-accent hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
        >
          Salvar rascunho
        </button>
        <button
          type="submit"
          name="acao"
          value="gerar"
          disabled={!podeSalvar}
          className={`rounded-[var(--radius-sm)] bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
        >
          {isPending ? "Gerando..." : "GERAR RELATÓRIO DOCX"}
        </button>
      </div>
    </form>
  );
}

function ChamadoPicker({
  chamados,
  selecionadoId,
  onSelecionar,
}: {
  chamados: ChamadoDaRt[];
  selecionadoId: string | null;
  onSelecionar: (id: string | null) => void;
}) {
  const [busca, setBusca] = useState("");
  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return chamados;
    return chamados.filter(
      (c) => c.assunto.toLowerCase().includes(termo) || (c.tomticketId ?? "").toLowerCase().includes(termo),
    );
  }, [chamados, busca]);

  return (
    <div className="mt-1 flex flex-col gap-2 rounded-[var(--radius-sm)] border border-border p-3">
      <button
        type="button"
        onClick={() => onSelecionar(null)}
        className={`self-start rounded-[var(--radius-sm)] px-2 py-1 text-xs font-medium ${
          selecionadoId === null ? "bg-accent text-white" : "text-text-secondary hover:text-text-primary"
        } ${FOCUS_RING}`}
      >
        Nenhum
      </button>
      <input
        type="search"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por protocolo ou assunto..."
        className={FIELD_INPUT}
      />
      <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
        {filtrados.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-text-tertiary">Nenhum chamado encontrado nessa RT.</p>
        ) : (
          filtrados.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelecionar(c.id)}
              className={`flex flex-col gap-0.5 rounded-[var(--radius-sm)] border p-2 text-left text-xs transition-colors ${
                c.id === selecionadoId
                  ? "border-accent bg-surface-input"
                  : "border-border hover:border-accent hover:bg-surface-input"
              } ${FOCUS_RING}`}
            >
              <span className="font-mono text-text-tertiary">{c.tomticketId ? `#${c.tomticketId}` : "sem protocolo"}</span>
              <span className="text-text-primary">{c.assunto}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
