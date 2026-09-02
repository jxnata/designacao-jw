import type { Config, Pessoa, TipoParte } from "./types";

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
    case "ministerio_consideracao":
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

/** Elegibilidade do "ajudante" de uma parte. Para a demonstração de
 * ministério é o ajudante propriamente dito (mesmo sexo do estudante). Para
 * o Estudo Bíblico de Congregação esse mesmo slot vira o leitor (só existe
 * em congregação de língua de sinais): homem batizado e ativo, com anciãos
 * entrando só se `config.usar_anciaos_leitura_ebc` estiver ligado. */
export function elegivelAjudante(
  tipo: TipoParte,
  sexoEstudante: string,
  p: Pessoa,
  config: Pick<Config, "usar_anciaos_leitura_ebc">,
): boolean {
  if (!p.ativo) return false;
  if (tipo === "estudo_biblico") {
    return p.sexo === "m" && p.batizado && (config.usar_anciaos_leitura_ebc || !p.anciao);
  }
  return p.sexo === sexoEstudante;
}
