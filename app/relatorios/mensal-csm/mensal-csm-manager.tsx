"use client";

import { useMemo, useState } from "react";
import { mesParaPeriodo, rotularMes } from "@/lib/relatorio-mensal/periodo";
import type { AlertasPreview, ResumoPeriodo } from "@/lib/relatorio-mensal/tipos";

type Opcao = { id: string; nome: string };
type Preview = { resumo: ResumoPeriodo; alertas: AlertasPreview };

const formatoData = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

export function MensalCsmManager({
  mesInicial,
  previewInicial,
  caps,
  regioes,
}: {
  mesInicial: string;
  previewInicial: Preview;
  caps: Opcao[];
  regioes: Opcao[];
}) {
  const [mes, setMes] = useState(mesInicial);
  const [capsId, setCapsId] = useState("");
  const [regiaoId, setRegiaoId] = useState("");
  const [nf, setNf] = useState("");

  const [preview, setPreview] = useState<Preview>(previewInicial);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Sem useEffect: a prévia inicial vem pronta do server (page.tsx) e cada
  // troca de mês/filtro chama a prévia a partir do próprio handler — mesmo
  // padrão de montar-rota-client.tsx (evita a regra react-hooks/set-state-in-effect).
  async function atualizarPrevia(proximo: { mes: string; capsId: string; regiaoId: string }) {
    const p = new URLSearchParams({ mes: proximo.mes });
    if (proximo.capsId) p.set("caps", proximo.capsId);
    if (proximo.regiaoId) p.set("regiao", proximo.regiaoId);
    setCarregando(true);
    setErro(null);
    try {
      const r = await fetch(`/relatorios/mensal-csm/preview?${p.toString()}`);
      if (!r.ok) throw new Error(await r.text());
      setPreview((await r.json()) as Preview);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar a prévia.");
    } finally {
      setCarregando(false);
    }
  }

  function trocarMes(valor: string) {
    const m = valor || mesInicial;
    setMes(m);
    void atualizarPrevia({ mes: m, capsId, regiaoId });
  }
  function trocarCaps(valor: string) {
    setCapsId(valor);
    void atualizarPrevia({ mes, capsId: valor, regiaoId });
  }
  function trocarRegiao(valor: string) {
    setRegiaoId(valor);
    void atualizarPrevia({ mes, capsId, regiaoId: valor });
  }

  const queryDownload = useMemo(() => {
    const p = new URLSearchParams({ mes });
    if (capsId) p.set("caps", capsId);
    if (regiaoId) p.set("regiao", regiaoId);
    if (nf.trim()) p.set("nf", nf.trim());
    return p.toString();
  }, [mes, capsId, regiaoId, nf]);

  const { inicio, fim } = mesParaPeriodo(mes);
  const total = preview.resumo.totalServicos;
  const semServicos = !carregando && total === 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-[var(--radius-md)] border border-border bg-surface p-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-text-secondary">
          Mês de referência
          <input
            type="month"
            value={mes}
            max={mesInicial}
            onChange={(e) => trocarMes(e.target.value)}
            className="rounded-[var(--radius-sm)] border border-border bg-surface-input px-3 py-2 text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-text-secondary">
          N° da nota fiscal <span className="font-normal text-text-tertiary">(opcional)</span>
          <input
            type="text"
            value={nf}
            onChange={(e) => setNf(e.target.value)}
            placeholder="Aparece na capa; em branco fica [N° DA NF]"
            className="rounded-[var(--radius-sm)] border border-border bg-surface-input px-3 py-2 text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-text-secondary">
          CAPS <span className="font-normal text-text-tertiary">(todos)</span>
          <select
            value={capsId}
            onChange={(e) => trocarCaps(e.target.value)}
            className="rounded-[var(--radius-sm)] border border-border bg-surface-input px-3 py-2 text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          >
            <option value="">Todos os CAPS</option>
            {caps.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-text-secondary">
          Região <span className="font-normal text-text-tertiary">(todas)</span>
          <select
            value={regiaoId}
            onChange={(e) => trocarRegiao(e.target.value)}
            className="rounded-[var(--radius-sm)] border border-border bg-surface-input px-3 py-2 text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          >
            <option value="">Todas as regiões</option>
            {regioes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nome}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-text-primary">Prévia — {rotularMes(mes)}</h2>
          <span className="text-xs text-text-tertiary">
            {formatoData.format(new Date(`${inicio}T00:00:00`))} – {formatoData.format(new Date(`${fim}T00:00:00`))}
          </span>
        </div>

        {erro ? (
          <p className="mt-3 text-sm text-danger">Não foi possível carregar a prévia ({erro}).</p>
        ) : (
          <div className={`mt-3 space-y-4 ${carregando ? "opacity-50" : ""}`}>
            <div className="grid grid-cols-3 gap-3">
              <Numero rotulo="Serviços validados" valor={preview.resumo.totalServicos} destaque />
              <Numero rotulo="Residências" valor={preview.resumo.totalRts} />
              <Numero rotulo="CAPS" valor={preview.resumo.totalCaps} />
            </div>

            {semServicos ? (
              <p className="rounded-[var(--radius-sm)] bg-surface-input px-3 py-2 text-sm text-text-secondary">
                Nenhum serviço validado nesse recorte — nada a gerar. Ajuste o mês ou os filtros.
              </p>
            ) : (
              <>
                <ul className="space-y-1 text-sm text-text-secondary">
                  <li>
                    <Alerta n={preview.alertas.semOs} sufixo="sem imagem da OS" />
                  </li>
                  <li>
                    <Alerta n={preview.alertas.semFotoAntes} sufixo="sem foto de antes" />
                  </li>
                  <li>
                    <Alerta n={preview.alertas.semFotoDepois} sufixo="sem foto de depois" />
                  </li>
                </ul>
                <p className="text-xs text-text-tertiary">
                  Os alertas não bloqueiam a geração — o quadro entra com um marcador &ldquo;sem foto&rdquo; no lugar.
                </p>

                {preview.resumo.porCaps.length > 0 && (
                  <div className="border-t border-border pt-3">
                    <p className="mb-1.5 text-xs font-medium text-text-secondary">Distribuição por CAPS (topo)</p>
                    <ul className="space-y-1 text-sm">
                      {preview.resumo.porCaps.slice(0, 5).map((c) => (
                        <li key={c.nome} className="flex justify-between gap-4 text-text-secondary">
                          <span className="truncate">{c.nome}</span>
                          <span className="tabular-nums font-medium text-text-primary">{c.total}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        <BotaoDownload
          href={`/relatorios/mensal-csm/gerar/xlsx?${queryDownload}`}
          rotulo="Baixar planilha (ANEXO 1 · .xlsx)"
          desabilitado={semServicos || carregando}
        />
        <BotaoDownload
          href={`/relatorios/mensal-csm/gerar/docx?${queryDownload}`}
          rotulo="Baixar documento (.docx)"
          desabilitado={semServicos || carregando}
        />
      </div>
      <p className="text-xs text-text-tertiary">
        O documento com muitas páginas de serviço pode levar alguns minutos para gerar — o download começa quando fica
        pronto.
      </p>
    </div>
  );
}

function Numero({ rotulo, valor, destaque }: { rotulo: string; valor: number; destaque?: boolean }) {
  return (
    <div className="rounded-[var(--radius-sm)] bg-surface-input px-3 py-2.5">
      <p className={`tabular-nums font-semibold text-text-primary ${destaque ? "text-2xl" : "text-lg"}`}>{valor}</p>
      <p className="mt-0.5 text-xs text-text-tertiary">{rotulo}</p>
    </div>
  );
}

function Alerta({ n, sufixo }: { n: number; sufixo: string }) {
  if (n === 0) return <span className="text-text-tertiary">✓ Nenhum serviço {sufixo}.</span>;
  return (
    <span>
      <span className="font-medium text-priority-alta">⚠ {n}</span> {n === 1 ? "serviço" : "serviços"} {sufixo}.
    </span>
  );
}

function BotaoDownload({ href, rotulo, desabilitado }: { href: string; rotulo: string; desabilitado: boolean }) {
  if (desabilitado) {
    return (
      <span className="cursor-not-allowed rounded-[var(--radius-sm)] bg-surface-input px-4 py-2 text-sm font-medium text-text-tertiary">
        {rotulo}
      </span>
    );
  }
  return (
    <a
      href={href}
      className="rounded-[var(--radius-sm)] bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
    >
      {rotulo}
    </a>
  );
}
