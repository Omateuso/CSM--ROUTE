"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RegistrarUrgenciaDialog } from "./registrar-urgencia-dialog";
import { UrgenciaCard } from "./urgencia-card";
import { FOCUS_RING } from "@/lib/ui/styles";
import type { UrgenciaRow } from "./types";

const SECOES: { titulo: string; statusDisplay: UrgenciaRow["statusDisplay"][]; sempreVisivel?: boolean }[] = [
  { titulo: "Solicitadas", statusDisplay: ["solicitada"], sempreVisivel: true },
  { titulo: "Em análise", statusDisplay: ["em_analise"] },
  { titulo: "Aguardando despacho", statusDisplay: ["validada"] },
  { titulo: "Em atendimento", statusDisplay: ["tecnico_escalado", "em_atendimento"] },
  { titulo: "Precisa de novo despacho", statusDisplay: ["pendente_novo_despacho"] },
  { titulo: "Concluídas", statusDisplay: ["concluida"] },
  { titulo: "Não validadas / canceladas", statusDisplay: ["nao_validada", "cancelada"] },
];

export function UrgenciasManager({ urgencias, podeGerenciar }: { urgencias: UrgenciaRow[]; podeGerenciar: boolean }) {
  const router = useRouter();
  const [registrarAberto, setRegistrarAberto] = useState(false);
  const [busca, setBusca] = useState("");

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return urgencias;
    return urgencias.filter(
      (u) =>
        u.codigo.toLowerCase().includes(termo) ||
        u.rtCodigo.toLowerCase().includes(termo) ||
        u.rtEndereco.toLowerCase().includes(termo) ||
        u.chamadoAssunto.toLowerCase().includes(termo) ||
        u.motivo.toLowerCase().includes(termo) ||
        (u.tomticketId ?? "").includes(termo),
    );
  }, [urgencias, busca]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <label className="sr-only" htmlFor="busca-urgencia">
          Buscar urgência
        </label>
        <input
          id="busca-urgencia"
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por código, RT, protocolo ou assunto..."
          className="w-full max-w-sm rounded-[var(--radius-sm)] border border-border-strong bg-surface-input px-3 py-2 text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        />
        {podeGerenciar && (
          <button
            type="button"
            onClick={() => setRegistrarAberto(true)}
            className={`ml-auto rounded-[var(--radius-sm)] bg-accent px-4 py-2 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover ${FOCUS_RING}`}
          >
            + Registrar urgência
          </button>
        )}
      </div>

      {SECOES.map((secao) => {
        const itens = filtradas.filter((u) => secao.statusDisplay.includes(u.statusDisplay));
        // seções vazias somem, exceto "Solicitadas" — fica sempre visível
        // como ponto de partida da tela, mesmo zerada.
        if (itens.length === 0 && !secao.sempreVisivel) return null;

        return (
          <section key={secao.titulo} className="mb-8">
            <h2 className="text-sm font-semibold text-text-primary">
              {secao.titulo} <span className="font-normal text-text-tertiary">({itens.length})</span>
            </h2>
            {itens.length === 0 ? (
              <p className="mt-3 rounded-[var(--radius-md)] border border-dashed border-border-strong bg-surface-input px-4 py-6 text-center text-xs text-text-tertiary">
                Nenhuma urgência aqui.
              </p>
            ) : (
              <div className="mt-3 flex flex-col gap-3">
                {itens.map((u) => (
                  <UrgenciaCard key={u.id} urgencia={u} />
                ))}
              </div>
            )}
          </section>
        );
      })}

      {podeGerenciar && (
        <RegistrarUrgenciaDialog
          key={registrarAberto ? "aberto" : "fechado"}
          open={registrarAberto}
          onClose={() => setRegistrarAberto(false)}
          onRegistrada={(urgenciaId) => router.push(`/urgencias/${urgenciaId}`)}
        />
      )}
    </div>
  );
}
