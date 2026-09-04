// Categorias de pendência (migration 0026) — compartilhado entre o select
// do técnico (formulário de reportar) e o rótulo exibido pro gerente
// (modal de Pendências em /validacao), pra não duplicar os textos em dois
// lugares e correr o risco deles saírem diferentes.
export type PendenciaCategoria =
  | "falta_material"
  | "aguardando_gestao"
  | "equipamento_analise"
  | "material_fabricacao"
  | "outro";

export const PENDENCIA_CATEGORIA_LABEL: Record<PendenciaCategoria, string> = {
  falta_material: "Falta material/peça",
  aguardando_gestao: "Precisa de decisão da gestão",
  equipamento_analise: "Equipamento retirado pra análise",
  material_fabricacao: "Material precisa ser fabricado",
  outro: "Outro motivo",
};

export const PENDENCIA_CATEGORIA_OPTIONS: { value: PendenciaCategoria; label: string }[] = (
  Object.keys(PENDENCIA_CATEGORIA_LABEL) as PendenciaCategoria[]
).map((value) => ({ value, label: PENDENCIA_CATEGORIA_LABEL[value] }));
