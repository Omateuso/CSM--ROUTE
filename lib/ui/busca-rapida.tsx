"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { NAV_GRUPOS } from "@/app/nav-links";
import { NavIcons } from "@/app/nav-icons";
import { PlacaRt, nomeSemCodigo } from "@/lib/ui/placa-rt";
import { FIELD_INPUT } from "@/lib/ui/styles";

// Busca rápida (18/09/2026) — Ctrl+K / ⌘K de qualquer tela do gerente ou
// da gestão. É a "cola" entre as telas: digitou uma RT, um protocolo do
// TomTicket ou o nome de uma página e vai direto, sem passar pelo menu.
//
// O que ela encontra:
// - Páginas do menu do perfil (NAV_GRUPOS) — por nome.
// - RTs — por código, nome ou bairro. A lista (98 linhas, RLS de leitura
//   pra todo perfil) é buscada UMA vez, na primeira abertura, e guardada
//   em memória do módulo. Gerente cai na lista de chamados já filtrada
//   pela RT; gestão cai na ficha da RT (que só ela tem).
// - Protocolo do TomTicket — 5 ou 6 dígitos: abre /chamados?busca=NNNNNN.
// - Qualquer outro texto — "Buscar nos chamados", mesmo destino.
//
// `<dialog>` nativo (foco preso e devolvido de graça), lista com
// role=listbox e navegação por setas; a opção ativa é anunciada por
// aria-activedescendant.

type Rt = { id: string; codigo: string; nome: string; bairro: string | null };

type Resultado = {
  id: string;
  grupo: "Páginas" | "RTs" | "Chamados";
  titulo: ReactNode;
  detalhe?: string;
  icone: ReactNode;
  href: string;
  /** Texto plano pro leitor de tela. */
  rotulo: string;
};

let cacheRts: Rt[] | null = null;
let promessaRts: Promise<Rt[]> | null = null;

async function buscarRts(): Promise<Rt[]> {
  const { data } = await createClient()
    .from("rts")
    .select("id, codigo, nome, bairro")
    .eq("ativo", true)
    .order("codigo");
  cacheRts = (data ?? []) as Rt[];
  return cacheRts;
}

function carregarRts(): Promise<Rt[]> {
  if (cacheRts) return Promise.resolve(cacheRts);
  if (!promessaRts) promessaRts = buscarRts();
  return promessaRts;
}

function normalizar(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function IconeBusca() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4-4" />
    </svg>
  );
}

export function BuscaRapida({
  role,
  trigger,
}: {
  role: "gerente" | "gestao";
  /** Recebe `abrir` e devolve o gatilho (o menu decide a aparência). */
  trigger: (abrir: () => void) => ReactNode;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listaId = useId();
  const [aberta, setAberta] = useState(false);
  const [termo, setTermo] = useState("");
  const [rts, setRts] = useState<Rt[]>(cacheRts ?? []);
  const [ativo, setAtivo] = useState(0);

  function abrir() {
    setTermo("");
    setAtivo(0);
    setAberta(true);
  }
  function fechar() {
    setAberta(false);
  }

  // Abre/fecha o <dialog> nativo conforme o estado; foca o campo ao abrir e
  // dispara o carregamento das RTs (só na primeira vez de verdade).
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (aberta && !d.open) {
      d.showModal();
      inputRef.current?.focus();
      if (!cacheRts) carregarRts().then(setRts);
    }
    if (!aberta && d.open) d.close();
  }, [aberta]);

  // Ctrl+K / ⌘K de qualquer lugar (menos dentro de outro campo que já use
  // o atalho — não há nenhum hoje; se surgir, ele que faça stopPropagation).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAberta((v) => !v);
        if (!aberta) {
          setTermo("");
          setAtivo(0);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aberta]);

  const resultados = useMemo<Resultado[]>(() => {
    const q = normalizar(termo);
    const out: Resultado[] = [];

    const paginas = NAV_GRUPOS[role].flatMap((g) => g.links);
    for (const p of paginas) {
      if (!q || normalizar(p.label).includes(q)) {
        out.push({
          id: `p-${p.href}`,
          grupo: "Páginas",
          titulo: p.label,
          icone: NavIcons[p.icon],
          href: p.href,
          rotulo: `Ir para ${p.label}`,
        });
      }
    }

    if (q) {
      const soDigitos = /^\d{5,6}$/.test(q);
      const qNum = q.replace(/\D/g, "");
      const encontradas = rts
        .filter((rt) => {
          const cod = normalizar(rt.codigo);
          if (qNum && cod.replace(/\D/g, "") === qNum) return true;
          return cod.includes(q) || normalizar(rt.nome).includes(q) || normalizar(rt.bairro ?? "").includes(q);
        })
        .slice(0, 6);
      for (const rt of encontradas) {
        const href =
          role === "gestao" ? `/rts/${rt.id}` : `/chamados?busca=${encodeURIComponent(rt.codigo)}`;
        out.push({
          id: `rt-${rt.id}`,
          grupo: "RTs",
          titulo: (
            <span className="flex items-center gap-2">
              <PlacaRt codigo={rt.codigo} />
              <span>{nomeSemCodigo(rt.nome, rt.codigo)}</span>
            </span>
          ),
          detalhe: role === "gestao" ? (rt.bairro ?? "ficha da RT") : `chamados em aberto${rt.bairro ? ` · ${rt.bairro}` : ""}`,
          icone: NavIcons.home,
          href,
          rotulo: `${rt.codigo} ${nomeSemCodigo(rt.nome, rt.codigo)}`,
        });
      }

      if (soDigitos) {
        out.push({
          id: `prot-${q}`,
          grupo: "Chamados",
          titulo: `Abrir protocolo #${q}`,
          detalhe: "TomTicket",
          icone: NavIcons.head,
          href: `/chamados?busca=${q}`,
          rotulo: `Abrir protocolo ${q}`,
        });
      } else {
        out.push({
          id: `busca-${q}`,
          grupo: "Chamados",
          titulo: `Buscar “${termo.trim()}” nos chamados`,
          detalhe: "assunto, RT ou protocolo",
          icone: NavIcons.head,
          href: `/chamados?busca=${encodeURIComponent(termo.trim())}`,
          rotulo: `Buscar ${termo.trim()} nos chamados`,
        });
      }
    }
    return out;
  }, [termo, rts, role]);

  const ativoSeguro = Math.min(ativo, Math.max(resultados.length - 1, 0));

  function ir(r: Resultado) {
    fechar();
    router.push(r.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    // Esc fecha sempre — num <input type="search"> o navegador usaria o Esc
    // só pra limpar o texto e o `cancel` do <dialog> não chegaria.
    if (e.key === "Escape") {
      e.preventDefault();
      fechar();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAtivo((a) => Math.min(a + 1, resultados.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAtivo((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = resultados[ativoSeguro];
      if (r) ir(r);
    }
  }

  // Agrupa preservando a ordem de aparição dos grupos.
  const grupos: { nome: Resultado["grupo"]; itens: Resultado[] }[] = [];
  for (const r of resultados) {
    const g = grupos.find((x) => x.nome === r.grupo);
    if (g) g.itens.push(r);
    else grupos.push({ nome: r.grupo, itens: [r] });
  }
  let indice = -1;

  return (
    <>
      {trigger(abrir)}
      <dialog
        ref={dialogRef}
        onCancel={(e) => {
          e.preventDefault();
          fechar();
        }}
        onClose={fechar}
        onClick={(e) => {
          if (e.target === dialogRef.current) fechar();
        }}
        aria-label="Busca rápida"
        className="fixed top-[12vh] left-1/2 m-0 w-[min(36rem,calc(100%-2rem))] -translate-x-1/2 overflow-hidden rounded-[var(--radius-lg)] bg-surface p-0 text-text-primary shadow-lift-overlay backdrop:bg-text-primary/35 backdrop:backdrop-blur-[2px] open:motion-safe:animate-[busca-in_160ms_var(--ease-out)]"
      >
        <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
          <span className="inline-flex h-5 w-5 text-text-tertiary" aria-hidden="true">
            <IconeBusca />
          </span>
          <input
            ref={inputRef}
            type="text"
            value={termo}
            onChange={(e) => {
              setTermo(e.target.value);
              setAtivo(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="RT, protocolo, bairro ou página…"
            aria-label="Buscar"
            role="combobox"
            aria-expanded="true"
            aria-controls={listaId}
            aria-activedescendant={resultados[ativoSeguro] ? `${listaId}-${resultados[ativoSeguro].id}` : undefined}
            autoComplete="off"
            className={`${FIELD_INPUT} border-0 bg-transparent px-1 py-1.5 text-[15px] focus:ring-0`}
          />
          <kbd className="hidden rounded-[5px] border border-border-strong bg-surface-input px-1.5 font-mono text-[11px] text-text-tertiary sm:inline-block">
            Esc
          </kbd>
        </div>

        <div id={listaId} role="listbox" aria-label="Resultados" className="max-h-[60vh] overflow-y-auto p-2">
          {grupos.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-text-tertiary">Nada encontrado.</p>
          )}
          {grupos.map((g) => (
            <div key={g.nome} className="mb-1.5">
              <p className="px-3 pt-2 pb-1 text-[11px] font-medium text-text-tertiary">{g.nome}</p>
              {g.itens.map((r) => {
                indice += 1;
                const i = indice;
                const on = i === ativoSeguro;
                return (
                  <button
                    key={r.id}
                    id={`${listaId}-${r.id}`}
                    type="button"
                    role="option"
                    aria-selected={on}
                    aria-label={r.rotulo}
                    onMouseEnter={() => setAtivo(i)}
                    onClick={() => ir(r)}
                    className={`flex w-full items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2 text-left text-sm transition-colors duration-100 ${
                      on ? "bg-accent-tint text-accent-on-tint" : "text-text-primary hover:bg-surface-hover"
                    }`}
                  >
                    <span className={`inline-flex h-[18px] w-[18px] shrink-0 ${on ? "text-accent" : "text-text-tertiary"}`} aria-hidden="true">
                      {r.icone}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">{r.titulo}</span>
                    {r.detalhe && <span className="shrink-0 text-xs text-text-tertiary">{r.detalhe}</span>}
                    {on && (
                      <kbd className="hidden shrink-0 rounded-[5px] border border-border-strong bg-surface px-1.5 font-mono text-[10px] text-text-tertiary sm:inline-block">
                        ↵
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </dialog>
    </>
  );
}
