import { invoke } from "@tauri-apps/api/core";
import {
  getConfig,
  historicoParaBalanceador,
  listarPartes,
  listarPessoas,
} from "./db";
import type {
  DesignacaoHistorica,
  DesignacaoResultado,
  ItemPreview,
  Parte,
  ParteParaDesignar,
  Pessoa,
  PessoaAssign,
  Semana,
} from "./types";
import { ROTULO_TIPO } from "./types";

function paraAssign(p: Pessoa): PessoaAssign {
  return { ...p, sexo: p.sexo };
}

/** Monta, para uma semana, a lista completa de "unidades de designação" na
 * ordem em que aparecem no programa: presidente, oração inicial, as partes
 * extraídas do wol (tesouros/ministério/vida cristã/estudo) e oração
 * final. Presidente e orações não vêm da apostila — são papéis que a
 * própria congregação preenche toda semana. */
export function unidadesDaSemana(semana: Semana, partes: Parte[]): ItemPreview[] {
  const unidades: ItemPreview[] = [];
  unidades.push({
    parte_id: `${semana.id}:presidente`,
    semana_id: semana.id,
    tipo: "presidente",
    titulo: ROTULO_TIPO.presidente,
    duracao_min: 0,
    tem_ajudante: false,
    pessoa_id: null,
    ajudante_id: null,
  });
  unidades.push({
    parte_id: `${semana.id}:oracao_inicial`,
    semana_id: semana.id,
    tipo: "oracao_inicial",
    titulo: ROTULO_TIPO.oracao_inicial,
    duracao_min: 0,
    tem_ajudante: false,
    pessoa_id: null,
    ajudante_id: null,
  });
  for (const p of partes) {
    unidades.push({
      parte_id: `${semana.id}:parte:${p.id}`,
      semana_id: semana.id,
      tipo: p.tipo,
      titulo: p.titulo,
      duracao_min: p.duracao_min,
      tem_ajudante: p.tem_ajudante,
      pessoa_id: null,
      ajudante_id: null,
    });
  }
  unidades.push({
    parte_id: `${semana.id}:oracao_final`,
    semana_id: semana.id,
    tipo: "oracao_final",
    titulo: ROTULO_TIPO.oracao_final,
    duracao_min: 0,
    tem_ajudante: false,
    pessoa_id: null,
    ajudante_id: null,
  });
  return unidades;
}

/** Busca as partes de cada semana no banco e monta a lista de unidades de
 * todas elas, já na ordem cronológica (por `ordinal`). */
export async function montarUnidades(semanas: Semana[]): Promise<ItemPreview[]> {
  const ordenadas = [...semanas].sort((a, b) => a.ordinal - b.ordinal);
  const todas: ItemPreview[] = [];
  for (const s of ordenadas) {
    const partes = await listarPartes(s.id);
    todas.push(...unidadesDaSemana(s, partes));
  }
  return todas;
}

/** Roda o balanceador em Rust sobre as unidades informadas e devolve o
 * preview já preenchido com as sugestões (editável na tela seguinte). */
export async function gerarPreview(
  semanas: Semana[],
  unidades: ItemPreview[],
): Promise<ItemPreview[]> {
  const pessoas = await listarPessoas(false);
  const historicoBruto = await historicoParaBalanceador();
  const config = await getConfig();
  const semanaOrdinalPorId = new Map(semanas.map((s) => [s.id, s.ordinal]));

  const historico: DesignacaoHistorica[] = historicoBruto.map((h) => ({
    pessoa_id: h.pessoa_id,
    tipo: h.tipo as ItemPreview["tipo"],
    semana_ordinal: h.semana_ordinal,
    como_ajudante: h.como_ajudante,
  }));

  // A oração inicial não passa pelo balanceador: é sempre feita por quem
  // preside a reunião naquela semana, então nem entra no sorteio.
  const partesParaDesignar: ParteParaDesignar[] = unidades
    .filter((u) => u.tipo !== "oracao_inicial")
    .map((u) => ({
      parte_id: u.parte_id,
      semana_ordinal: semanaOrdinalPorId.get(u.semana_id) ?? 0,
      tipo: u.tipo,
      tem_ajudante: u.tem_ajudante,
    }));

  const resultado = await invoke<DesignacaoResultado[]>("gerar_atribuicoes", {
    pessoas: pessoas.map(paraAssign),
    historico,
    partes: partesParaDesignar,
    config: {
      usar_servos_presidencia: config.usar_servos_presidencia,
      usar_servos_estudo_biblico: config.usar_servos_estudo_biblico,
      usar_anciaos_leitura: config.usar_anciaos_leitura,
    },
  });

  const porId = new Map(resultado.map((r) => [r.parte_id, r]));
  const presidentePorSemana = new Map<number, number | null>();
  for (const u of unidades) {
    if (u.tipo === "presidente") {
      presidentePorSemana.set(u.semana_id, porId.get(u.parte_id)?.pessoa_id ?? null);
    }
  }

  return unidades.map((u) => {
    if (u.tipo === "oracao_inicial") {
      return { ...u, pessoa_id: presidentePorSemana.get(u.semana_id) ?? null, ajudante_id: null };
    }
    const r = porId.get(u.parte_id);
    return { ...u, pessoa_id: r?.pessoa_id ?? null, ajudante_id: r?.ajudante_id ?? null };
  });
}
