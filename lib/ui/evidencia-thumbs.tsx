import { FOCUS_RING } from "./styles";

// Tira de miniaturas de evidência — compartilhada entre a Validação
// (Aguardando validação, Validados recentemente, Apontados) e as
// Pendências, pra as duas telas irmãs mostrarem a evidência do mesmo jeito
// (antes era link de texto "Foto → OS →" na Validação e miniatura só na
// Pendências). Cada item é um par {url, label} já resolvido pelo caller —
// o componente não sabe de `momento`, só de `tipo` (pra saber se desenha
// miniatura de imagem ou player de áudio).
export type EvidenciaThumbItem = { url: string | null; label: string; tipo?: "imagem" | "audio" };

// Rótulo canônico a partir do tipo/momento da evidência (0014/0023/0025/0051)
// — usado pelos cards da Validação, que trabalham com a forma crua.
export function rotuloEvidencia(e: { tipo: string; momento?: string | null }): string {
  if (e.tipo === "os") return "OS";
  if (e.tipo === "documento") return "Documento";
  if (e.tipo === "audio") return "Áudio do relato";
  if (e.momento === "antes") return "Foto antes";
  if (e.momento === "depois") return "Foto depois";
  if (e.momento === "parcial") return "Foto parcial";
  if (e.momento === "revisao") return "Foto da revisão";
  return "Foto";
}

export function EvidenciaThumbs({ itens }: { itens: EvidenciaThumbItem[] }) {
  if (itens.length === 0) return null;
  return (
    <div className="flex flex-wrap items-end gap-3">
      {itens.map((it, i) => {
        if (!it.url) {
          return (
            <span key={i} className="text-[11px] text-text-tertiary">
              {it.label}: não anexada
            </span>
          );
        }
        if (it.tipo === "audio") {
          return (
            <div key={i} className="flex flex-col items-start gap-1">
              <span className="text-[11px] font-medium text-text-secondary">{it.label}</span>
              <audio src={it.url} controls className="h-8 max-w-[220px]" />
            </div>
          );
        }
        return (
          <a
            key={i}
            href={it.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex flex-col items-start gap-1 ${FOCUS_RING}`}
          >
            <span className="text-[11px] font-medium text-text-secondary">{it.label}</span>
            {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada de bucket privado */}
            <img
              src={it.url}
              alt={it.label}
              className="h-24 w-24 rounded-[var(--radius-sm)] border border-border object-cover transition-opacity hover:opacity-80"
            />
          </a>
        );
      })}
    </div>
  );
}
