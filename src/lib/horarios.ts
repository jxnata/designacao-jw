import type { Config, Parte } from "./types";

/** Duração fixa (min) do bloco de abertura: cântico + oração, antes dos
 * comentários iniciais — conferido no PDF modelo (7:30 -> 7:35). */
const ABERTURA_MIN = 5;
const COMENTARIOS_INICIAIS_MIN = 1;
const COMENTARIOS_FINAIS_MIN = 3;
const CANTICO_MEIO_MIN = 5;

export interface BlocoHorario {
  chave: string;
  rotulo: string;
  horario: string; // HH:MM
}

function somarMinutos(hhmm: string, min: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + min;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/**
 * Calcula os horários de início de cada bloco da reunião, seguindo a regra
 * simplificada combinada no planejamento: cada parte soma sua duração mais
 * `transicao_min` (exceto a primeira, que emenda direto nos comentários
 * iniciais); cântico do meio, comentários finais e cântico final são blocos
 * fixos entre as seções. Congregações com transições diferentes das
 * conferidas no modelo podem ajustar `transicao_min` na página de
 * configuração.
 */
export function calcularHorarios(config: Config, partes: Parte[]): Record<string, string> {
  const transicao = config.transicao_min;
  const horarios: Record<string, string> = {};
  let t = config.horario;

  horarios["cantico_inicial"] = t;
  t = somarMinutos(t, ABERTURA_MIN);
  horarios["comentarios_iniciais"] = t;
  t = somarMinutos(t, COMENTARIOS_INICIAIS_MIN);

  let primeiraDaSecaoVidaCrista = true;
  partes.forEach((p, i) => {
    if (p.secao === "vida_crista" && primeiraDaSecaoVidaCrista) {
      primeiraDaSecaoVidaCrista = false;
      horarios["cantico_meio"] = t;
      t = somarMinutos(t, CANTICO_MEIO_MIN);
    } else if (i > 0) {
      t = somarMinutos(t, transicao);
    }
    horarios[`parte_${p.id}`] = t;
    t = somarMinutos(t, p.duracao_min);
  });

  horarios["comentarios_finais"] = t;
  t = somarMinutos(t, COMENTARIOS_FINAIS_MIN);
  horarios["cantico_final"] = t;

  return horarios;
}
