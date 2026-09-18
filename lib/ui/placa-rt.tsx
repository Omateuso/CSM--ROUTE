import { PLACA_RT } from "@/lib/ui/styles";

// Placa da RT — assinatura visual do produto (nova identidade, 18/09/2026):
// o código permanente da casa em mono, com moldura, como a placa de número
// na fachada. Ver PLACA_RT em lib/ui/styles.ts.
export function PlacaRt({ codigo, className = "" }: { codigo: string; className?: string }) {
  return <span className={`${PLACA_RT} ${className}`}>{codigo}</span>;
}

// Os nomes de RT no banco costumam vir como "SRT 40 — Taquara": ao lado da
// placa, repetir o código é ruído. Devolve só o que vem depois do código
// (ou o nome inteiro, se não começar por ele).
export function nomeSemCodigo(nome: string | null | undefined, codigo: string) {
  if (!nome) return "";
  const limpo = nome.trim();
  if (!limpo.toLowerCase().startsWith(codigo.trim().toLowerCase())) return limpo;
  return limpo.slice(codigo.trim().length).replace(/^[\s—–-]+/, "").trim() || limpo;
}
