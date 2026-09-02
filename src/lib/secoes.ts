import type { Secao, TipoParte } from "./types";

/** A que seção do programa cada tipo de parte pertence, para colorir a UI
 * como no wol (presidente/orações não têm seção — ficam neutros). */
export const SECAO_POR_TIPO: Partial<Record<TipoParte, Secao>> = {
  tesouros: "tesouros",
  joias: "tesouros",
  leitura: "ministerio",
  ministerio_discurso: "ministerio",
  ministerio_demonstracao: "ministerio",
  ministerio_consideracao: "ministerio",
  vida_crista: "vida_crista",
  vida_crista_ancioes: "vida_crista",
  necessidades_locais: "vida_crista",
  estudo_biblico: "vida_crista",
};

/** Mesmas cores usadas nas barras de seção da impressão (ver
 * SemanaImpressa.tsx). */
export const CORES_SECAO: Record<Secao, { borda: string }> = {
  tesouros: { borda: "#3B696F" },
  ministerio: { borda: "#A66902" },
  vida_crista: { borda: "#96141F" },
};
