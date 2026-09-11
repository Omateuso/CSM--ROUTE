"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PrioridadeBadge } from "@/app/chamados/prioridade-badge";
import { SlaBadge } from "@/app/chamados/sla-badge";
import { UrgenciaStatusBadge } from "./urgencia-status-badge";
import { URGENCIA_ORIGEM_LABEL } from "./urgencia-origem";
import { tomticketSearchUrl } from "@/lib/tomticket/busca";
import { FOCUS_RING } from "@/lib/ui/styles";
import type { UrgenciaRow } from "./types";

function formatarTempoDecorrido(criadoEm: string): string {
  const ms = Date.now() - new Date(criadoEm).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "agora mesmo";
  if (min < 60) return `${min} min atrás`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `${horas}h atrás`;
  const dias = Math.floor(horas / 24);
  return `${dias} dia${dias === 1 ? "" : "s"} atrás`;
}

const formatoHora = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

// "Tempo decorrido" precisa ficar vivo sem recarregar a página — recalcula
// a cada minuto, client-side. Prioridade mostrada é sempre a do CHAMADO
// (TomTicket, nunca alterada por este módulo) — item 9 do prompt: deixar
// explícito que "baixa" não significa que deixou de ser urgente
// operacionalmente. A classificação própria da urgência (se já validada)
// aparece à parte, com rótulo distinto, pra não confundir as duas escalas.
export function UrgenciaCard({ urgencia }: { urgencia: UrgenciaRow }) {
  const [tempoDecorrido, setTempoDecorrido] = useState(() => formatarTempoDecorrido(urgencia.criadoEm));

  useEffect(() => {
    const id = setInterval(() => setTempoDecorrido(formatarTempoDecorrido(urgencia.criadoEm)), 60000);
    return () => clearInterval(id);
  }, [urgencia.criadoEm]);

  return (
    <Link
      href={`/urgencias/${urgencia.id}`}
      className={`block rounded-[var(--radius-md)] border border-border bg-surface p-4 transition-colors hover:border-border-strong ${FOCUS_RING}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-text-secondary">{urgencia.codigo}</span>
        <span className="font-mono text-xs text-text-tertiary">{urgencia.rtCodigo}</span>
        {urgencia.tomticketId && (
          <a
            href={tomticketSearchUrl(urgencia.tomticketId)}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={`font-mono text-xs text-accent hover:text-accent-hover ${FOCUS_RING}`}
          >
            #{urgencia.tomticketId}
          </a>
        )}
        <span className="ml-auto">
          <UrgenciaStatusBadge status={urgencia.statusDisplay} />
        </span>
      </div>

      <p className="mt-2 text-sm font-medium text-text-primary">{urgencia.chamadoAssunto}</p>
      <p className="mt-1 text-sm text-text-secondary">{urgencia.motivo}</p>
      <p className="mt-1 text-xs text-text-tertiary">
        {urgencia.rtEndereco} · {urgencia.regiaoNome}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-tertiary">
        <span className="flex items-center gap-1">
          <span className="text-text-tertiary">TomTicket:</span>
          <PrioridadeBadge prioridade={urgencia.chamadoPrioridade} />
        </span>
        <SlaBadge slaPrazo={urgencia.chamadoSlaPrazo} status={urgencia.chamadoStatus} />
        {urgencia.prioridadeUrgencia && (
          <span className="flex items-center gap-1">
            <span className="text-text-tertiary">Classificação:</span>
            <PrioridadeBadge prioridade={urgencia.prioridadeUrgencia} />
          </span>
        )}
        <span>
          {URGENCIA_ORIGEM_LABEL[urgencia.origem]} · {urgencia.solicitante}
        </span>
        <span>
          {formatoHora.format(new Date(urgencia.criadoEm))} — {tempoDecorrido}
        </span>
        {urgencia.equipeMaisProxima && (
          <span>
            Equipe mais próxima hoje: {urgencia.equipeMaisProxima.nome} (~
            {urgencia.equipeMaisProxima.distanciaKm.toFixed(1)} km em linha reta)
          </span>
        )}
      </div>
    </Link>
  );
}
