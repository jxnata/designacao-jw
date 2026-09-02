import { invoke } from "@tauri-apps/api/core";
import {
  getConfig,
  historicoParaBalanceador,
  listarDesignacoesPorSemana,
  listarPartes,
  listarPessoas,
} from "./db";
import type {
  Config,
  DesignacaoHistorica,
  DesignacaoResultado,
  ItemPreview,
  Parte,
  ParteParaDesignar,
  Pessoa,
  PessoaAssign,
  Sala,
  Semana,
} from "./types";
import { ROTULO_TIPO } from "./types";
import { SECAO_POR_TIPO } from "./secoes";

/** Salas adicionais, na ordem em que devem aparecer (depois do salão
 * principal). Sala C só faz sentido quando a Sala B também está ativa — essa
 * regra já é reforçada na tela de Configurações. */
const SALAS_ADICIONAIS: Sala[] = ["b", "c"];

/** Monta a chave sintética de uma unidade de designação. Salas adicionais
 * ganham um sufixo `@sala` — o salão principal não leva sufixo, para não
 * quebrar dados/edições já gravados antes da feature de salas existir. */
export function chaveUnidade(semanaId: number, sufixo: string, sala: Sala): string {
  const base = `${semanaId}:${sufixo}`;
  return sala === "principal" ? base : `${base}@${sala}`;
}

/** Desfaz `chaveUnidade`, devolvendo a semana, o `parte_id` numérico (ou
 * `null` para presidente/orações) e a sala. */
export function parsearChave(chave: string): { semana_id: number; parte_id: number | null; sala: Sala } {
  const [semSala, sufixoSala] = chave.split("@") as [string, Sala | undefined];
  const sala: Sala = sufixoSala ?? "principal";
  const [semanaIdTexto, , parteIdTexto] = semSala.split(":");
  const parte_id = semSala.includes(":parte:") ? Number(parteIdTexto) : null;
  return { semana_id: Number(semanaIdTexto), parte_id, sala };
}

function paraAssign(p: Pessoa): PessoaAssign {
  return { ...p, sexo: p.sexo };
}

/** Monta, para uma semana, a lista completa de "unidades de designação" na
 * ordem em que aparecem no programa: presidente, oração inicial, as partes
 * extraídas do wol (tesouros/ministério/vida cristã/estudo) e oração
 * final. Presidente e orações não vêm da apostila — são papéis que a
 * própria congregação preenche toda semana.
 *
 * Quando a congregação usa salas adicionais (`sala_b`/`sala_c`), cada sala
 * ativa ganha seu próprio presidente e sua própria réplica das partes de
 * Leitura da Bíblia e Faça Seu Melhor no Ministério — as únicas que fazem
 * sentido fora do salão principal. */
export function unidadesDaSemana(
  semana: Semana,
  partes: Parte[],
  config: Pick<Config, "congregacao_sinais" | "sala_b" | "sala_c">,
): ItemPreview[] {
  const unidades: ItemPreview[] = [];
  unidades.push({
    parte_id: chaveUnidade(semana.id, "presidente", "principal"),
    semana_id: semana.id,
    tipo: "presidente",
    titulo: ROTULO_TIPO.presidente,
    duracao_min: 0,
    tem_ajudante: false,
    pessoa_id: null,
    ajudante_id: null,
    sala: "principal",
  });
  unidades.push({
    parte_id: chaveUnidade(semana.id, "oracao_inicial", "principal"),
    semana_id: semana.id,
    tipo: "oracao_inicial",
    titulo: ROTULO_TIPO.oracao_inicial,
    duracao_min: 0,
    tem_ajudante: false,
    pessoa_id: null,
    ajudante_id: null,
    sala: "principal",
  });
  for (const p of partes) {
    unidades.push({
      parte_id: chaveUnidade(semana.id, `parte:${p.id}`, "principal"),
      semana_id: semana.id,
      tipo: p.tipo,
      titulo: p.titulo,
      duracao_min: p.duracao_min,
      // Estudo Bíblico de Congregação ganha o slot de leitor nas
      // congregações comuns (alguém lê o parágrafo em voz alta enquanto o
      // dirigente conduz) — em congregação de língua de sinais isso não
      // existe, pois a condução já é toda em sinais.
      tem_ajudante: p.tipo === "estudo_biblico" ? !config.congregacao_sinais : p.tem_ajudante,
      pessoa_id: null,
      ajudante_id: null,
      sala: "principal",
    });
  }
  unidades.push({
    parte_id: chaveUnidade(semana.id, "oracao_final", "principal"),
    semana_id: semana.id,
    tipo: "oracao_final",
    titulo: ROTULO_TIPO.oracao_final,
    duracao_min: 0,
    tem_ajudante: false,
    pessoa_id: null,
    ajudante_id: null,
    sala: "principal",
  });

  const partesMinisterio = partes.filter((p) => SECAO_POR_TIPO[p.tipo] === "ministerio");
  const salasAtivas = SALAS_ADICIONAIS.filter(
    (sala) => (sala === "b" && config.sala_b) || (sala === "c" && config.sala_b && config.sala_c),
  );
  for (const sala of salasAtivas) {
    unidades.push({
      parte_id: chaveUnidade(semana.id, "presidente", sala),
      semana_id: semana.id,
      tipo: "presidente",
      titulo: ROTULO_TIPO.presidente,
      duracao_min: 0,
      tem_ajudante: false,
      pessoa_id: null,
      ajudante_id: null,
      sala,
    });
    for (const p of partesMinisterio) {
      unidades.push({
        parte_id: chaveUnidade(semana.id, `parte:${p.id}`, sala),
        semana_id: semana.id,
        tipo: p.tipo,
        titulo: p.titulo,
        duracao_min: p.duracao_min,
        tem_ajudante: p.tem_ajudante,
        pessoa_id: null,
        ajudante_id: null,
        sala,
      });
    }
  }

  return unidades;
}

/** Busca as partes de cada semana no banco e monta a lista de unidades de
 * todas elas, já na ordem cronológica (por `ordinal`). */
export async function montarUnidades(semanas: Semana[]): Promise<ItemPreview[]> {
  const ordenadas = [...semanas].sort((a, b) => a.ordinal - b.ordinal);
  const config = await getConfig();
  const todas: ItemPreview[] = [];
  for (const s of ordenadas) {
    const partes = await listarPartes(s.id);
    todas.push(...unidadesDaSemana(s, partes, config));
  }
  return todas;
}

/** Carrega o preview editável de semanas já designadas (`status = 'final'`),
 * preenchendo cada unidade com o que já está gravado — sem rodar o
 * balanceador. Usado pela edição de designações existentes. */
export async function carregarPreviewExistente(semanas: Semana[]): Promise<ItemPreview[]> {
  const unidades = await montarUnidades(semanas);
  const porChave = new Map<string, { pessoa_id: number | null; ajudante_id: number | null }>();
  for (const s of semanas) {
    const designacoes = await listarDesignacoesPorSemana(s.id);
    for (const d of designacoes) {
      const sufixo = d.parte_id ? `parte:${d.parte_id}` : d.tipo;
      const chave = chaveUnidade(s.id, sufixo, d.sala);
      porChave.set(chave, { pessoa_id: d.pessoa_id, ajudante_id: d.ajudante_id });
    }
  }
  return unidades.map((u) => {
    const d = porChave.get(u.parte_id);
    return d ? { ...u, pessoa_id: d.pessoa_id, ajudante_id: d.ajudante_id } : u;
  });
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
      usar_anciaos_leitura_ebc: config.usar_anciaos_leitura_ebc,
    },
  });

  const porId = new Map(resultado.map((r) => [r.parte_id, r]));
  const presidentePorSemana = new Map<number, number | null>();
  for (const u of unidades) {
    // A oração inicial sempre acompanha o presidente do salão principal,
    // mesmo quando há salas adicionais com presidente próprio.
    if (u.tipo === "presidente" && u.sala === "principal") {
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
