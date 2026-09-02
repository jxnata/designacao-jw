import type { Pessoa, TipoParte } from "./types";

/** Espelho em TS das regras de `src-tauri/src/assign/rules.rs`, usado só
 * para ordenar/realçar as opções elegíveis no `<select>` do preview — a
 * fonte da verdade da designação automática é sempre o Rust. */
export function elegivel(tipo: TipoParte, p: Pessoa): boolean {
  if (!p.ativo) return false;
  switch (tipo) {
    case "presidente":
      return p.anciao || p.servo;
    case "oracao_inicial":
    case "oracao_final":
      return p.sexo === "m" && p.batizado;
    case "tesouros":
    case "joias":
    case "vida_crista":
      return p.anciao || p.servo;
    case "leitura":
      return p.sexo === "m";
    case "ministerio_demonstracao":
      return p.sexo === "f";
    case "ministerio_discurso":
      return p.sexo === "m" && p.batizado;
    case "vida_crista_ancioes":
    case "necessidades_locais":
      return p.anciao;
    case "estudo_biblico":
      return p.anciao || p.servo;
  }
}

export function elegivelAjudante(sexoEstudante: string, p: Pessoa): boolean {
  return p.ativo && p.sexo === sexoEstudante;
}

/** Ordena pessoas elegíveis primeiro (mantendo a ordem alfabética dentro de
 * cada grupo), para o `<select>` do preview. */
export function ordenarParaSelect(tipo: TipoParte, pessoas: Pessoa[]): Pessoa[] {
  return [...pessoas].sort((a, b) => {
    const ea = elegivel(tipo, a) ? 0 : 1;
    const eb = elegivel(tipo, b) ? 0 : 1;
    if (ea !== eb) return ea - eb;
    return a.nome.localeCompare(b.nome, "pt-BR");
  });
}
