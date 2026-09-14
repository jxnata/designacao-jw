// Converte o array de semanas que a lib `meeting-schedules-parser` extrai
// do `.jwpub` (`MWBSchedule`) para o mesmo formato `SemanaWeb`/`ParteWeb`
// que o parser de PDF produz (ver `parse.ts`) — mesma retrocompatibilidade
// com banco, balanceador e impressão.
//
// Este arquivo é puro de propósito: só `import type` da lib (apagado na
// compilação), nada de `loadPub` nem de qualquer runtime que dependa de
// WASM/crypto — por isso roda em vitest/Node sem tocar em `window`.
//
// Ponto de atenção confirmado no código-fonte da lib: o "campo sem sufixo"
// muda de papel por seção — em Tesouros o discurso e a leitura da Bíblia
// trazem o TÍTULO no campo sem sufixo (`mwb_tgw_talk`) ou o MATERIAL
// (`mwb_tgw_bread`, título em `_title`); em Faça Seu Melhor no Ministério
// (`mwb_ayf_partN`) o campo sem sufixo é a DESCRIÇÃO/cenário (título em
// `_type`); em Nossa Vida Cristã (`mwb_lc_partN`) o campo sem sufixo é o
// TÍTULO (descrição em `_content`), exceto o Estudo Bíblico de Congregação
// (`mwb_lc_cbs`), que volta a ser MATERIAL (título em `_title`).

import type { MWBSchedule, WSchedule } from "meeting-schedules-parser";
import { classificar } from "./parse";
import { formatarIntervalo, interpretarCabecalho, semanaIso } from "./datas";
import type { ParteWeb, Secao, SemanaWeb, TipoParte } from "../types";

/** Ano/mês/idioma lidos do nome do arquivo `.jwpub` (ver `jwpub.ts`). */
export interface EdicaoJwpub {
  ano: number;
  mes: number;
  idioma: string;
}

// A apostila não imprime o tempo dessas quatro partes como dado variável, e
// a lib descarta o "(N min.)" delas ao montar `MWBSchedule` — são fixas
// desde a reformulação de 2024 (mesmos valores que o parser de PDF obtém
// lendo "(10 min.)"/"(4 min.)"/"(30 min.)" no corpo da apostila).
const DURACAO_TESOUROS = 10;
const DURACAO_JOIAS = 10;
const DURACAO_LEITURA = 4;
const DURACAO_ESTUDO_BIBLICO = 30;

/** Nenhum cântico do repertório passa deste número. Usado para descartar
 * texto substituto (ex.: "Cântico e oração" sem número) que a lib às vezes
 * devolve em `mwb_song_middle`/`mwb_song_conclude`. */
const CANTICO_MAX = 163;

function numeroDoTitulo(titulo: string | undefined): number | null {
  const m = /^\s*(\d+)[.．]\s*/.exec(titulo ?? "");
  return m ? Number(m[1]) : null;
}

function semNumero(titulo: string | undefined): string {
  return (titulo ?? "").replace(/^\s*\d+[.．]\s*/, "").trim();
}

/** Normaliza `mwb_song_middle`/`mwb_song_conclude` (`number | string`) para
 * `number | null` — mesmo formato que o parser de PDF produz. */
export function numeroCantico(valor: number | string | null | undefined): number | null {
  let n: number;
  if (typeof valor === "number") {
    n = valor;
  } else if (typeof valor === "string") {
    const m = /(\d{1,3})/.exec(valor);
    if (!m) return null;
    n = Number(m[1]);
  } else {
    return null;
  }
  return Number.isFinite(n) && n > 0 && n <= CANTICO_MAX ? n : null;
}

/** A apostila em SALMO/1 CORÍNTIOS/etc. sai em caixa alta no dado da lib
 * ("SALMO 105", "1 CORÍNTIOS 5-7"); o PDF produz "Salmo 105" — normaliza
 * para o mesmo formato de exibição. */
function normalizarLeitura(texto: string): string {
  return texto
    .trim()
    .toLocaleLowerCase("pt-BR")
    .replace(/(^|[\s(])(\p{L})/gu, (_, antes: string, letra: string) => antes + letra.toLocaleUpperCase("pt-BR"));
}

interface DatasSemana {
  inicio: Date;
  intervalo_texto: string;
}

/** A lib carimba o ano da semana a partir do nome do arquivo (`ano` da
 * edição), não do conteúdo — então numa edição de janeiro cuja primeira
 * semana ainda pertence a dezembro, o ano sai um a mais. Corrige aqui. */
function datasDaSemana(s: MWBSchedule, edicao: EdicaoJwpub): DatasSemana | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec((s.mwb_week_date ?? "").replace(/\//g, "-"));
  const mesDaSemana = iso ? Number(iso[2]) : null;
  const anoBase = edicao.mes === 1 && mesDaSemana === 12 ? edicao.ano - 1 : edicao.ano;

  if (s.mwb_week_date_locale) {
    const cab = interpretarCabecalho(s.mwb_week_date_locale, anoBase);
    if (cab) return { inicio: cab.inicio, intervalo_texto: cab.intervalo_texto };
  }

  if (!iso) return null;
  const inicio = new Date(Date.UTC(anoBase, Number(iso[2]) - 1, Number(iso[3])));
  const fim = new Date(inicio.getTime() + 6 * 86400000);
  return { inicio, intervalo_texto: formatarIntervalo(inicio, fim) };
}

function montarPartes(s: MWBSchedule): ParteWeb[] {
  const partes: ParteWeb[] = [];

  function add(
    secao: Secao,
    titulo: string,
    duracao_min: number,
    descricao: string,
    tituloNumerado: string | undefined,
    forcado?: { tipo: TipoParte; tem_ajudante: boolean },
  ): void {
    const classificacao = forcado ?? classificar(secao, titulo, descricao);
    partes.push({
      ordem: partes.length + 1,
      numero: numeroDoTitulo(tituloNumerado) ?? partes.length + 1,
      secao,
      titulo,
      duracao_min,
      descricao,
      ...classificacao,
    });
  }

  // 1 — discurso de Tesouros da Palavra de Deus.
  add(
    "tesouros",
    s.mwb_tgw_talk || semNumero(s.mwb_tgw_talk_title),
    DURACAO_TESOUROS,
    "",
    s.mwb_tgw_talk_title,
    { tipo: "tesouros", tem_ajudante: false },
  );

  // 2 — Joias espirituais.
  add(
    "tesouros",
    semNumero(s.mwb_tgw_gems_title) || "Joias espirituais",
    DURACAO_JOIAS,
    "",
    s.mwb_tgw_gems_title,
    { tipo: "joias", tem_ajudante: false },
  );

  // 3 — Leitura da Bíblia (o título vem em `_title`; o campo sem sufixo é
  // o material de leitura).
  add(
    "tesouros",
    semNumero(s.mwb_tgw_bread_title) || "Leitura da Bíblia",
    DURACAO_LEITURA,
    s.mwb_tgw_bread ?? "",
    s.mwb_tgw_bread_title,
    { tipo: "leitura", tem_ajudante: false },
  );

  // 4.. — Faça Seu Melhor no Ministério: o campo sem sufixo é a
  // descrição/cenário; o título vem em `_type` (classificação depende do
  // texto, por isso passa por `classificar()`).
  for (let i = 1; i <= 4 && i <= (s.mwb_ayf_count ?? 0); i++) {
    const src = (s as Record<string, unknown>)[`mwb_ayf_part${i}`] as string | undefined;
    const tipoTexto = (s as Record<string, unknown>)[`mwb_ayf_part${i}_type`] as string | undefined;
    const tituloNumerado = (s as Record<string, unknown>)[`mwb_ayf_part${i}_title`] as string | undefined;
    const tempo = (s as Record<string, unknown>)[`mwb_ayf_part${i}_time`] as number | undefined;
    if (src === undefined && tituloNumerado === undefined) continue;
    const titulo = tipoTexto ?? semNumero(tituloNumerado);
    add("ministerio", titulo, tempo ?? 0, src ?? "", tituloNumerado);
  }

  // Nossa Vida Cristã: o campo sem sufixo já é o título; a descrição (se
  // houver) vem em `_content`.
  for (let i = 1; i <= 2 && i <= (s.mwb_lc_count ?? 0); i++) {
    const titulo = (s as Record<string, unknown>)[`mwb_lc_part${i}`] as string | undefined;
    const conteudo = (s as Record<string, unknown>)[`mwb_lc_part${i}_content`] as string | undefined;
    const tituloNumerado = (s as Record<string, unknown>)[`mwb_lc_part${i}_title`] as string | undefined;
    const tempo = (s as Record<string, unknown>)[`mwb_lc_part${i}_time`] as number | undefined;
    if (titulo === undefined && tituloNumerado === undefined) continue;
    add("vida_crista", titulo ?? semNumero(tituloNumerado), tempo ?? 0, conteudo ?? "", tituloNumerado);
  }

  // Última — Estudo Bíblico de Congregação (o título vem em `_title`; o
  // campo sem sufixo é o material).
  add(
    "vida_crista",
    semNumero(s.mwb_lc_cbs_title) || "Estudo bíblico de congregação",
    DURACAO_ESTUDO_BIBLICO,
    s.mwb_lc_cbs ?? "",
    s.mwb_lc_cbs_title,
    { tipo: "estudo_biblico", tem_ajudante: false },
  );

  return partes;
}

function ehSemanaMwb(s: MWBSchedule | WSchedule): s is MWBSchedule {
  return "mwb_week_date" in s;
}

/** Mapeia uma semana. Devolve `null` quando não é possível determinar a
 * data (semana atípica ou dado incompleto fora do enhanced parsing) — quem
 * chama decide se conta como "ignorada". */
export function mapearSemanaJwpub(s: MWBSchedule, edicao: EdicaoJwpub): SemanaWeb | null {
  const datas = datasDaSemana(s, edicao);
  if (!datas) return null;

  const { ano, semana_iso } = semanaIso(datas.inicio);
  return {
    ano,
    semana_iso,
    doc_id: `mwb:${ano}-${semana_iso}`,
    intervalo_texto: datas.intervalo_texto,
    leitura_semanal: normalizarLeitura(s.mwb_weekly_bible_reading ?? ""),
    cantico_inicial: numeroCantico(s.mwb_song_first),
    cantico_meio: numeroCantico(s.mwb_song_middle),
    cantico_final: numeroCantico(s.mwb_song_conclude),
    partes: montarPartes(s),
  };
}

/** Mapeia o array inteiro devolvido por `loadPub()`. Semanas que a lib
 * devolveu para a Sentinela (`WSchedule`) são ignoradas; semanas que
 * lançarem ao mapear (ex.: um evento que quebra o formato esperado, como
 * assembleia/congresso) são puladas — `ignoradas` conta as duas situações,
 * para exibição na tela de importação. */
export function mapearSemanasJwpub(
  bruto: (MWBSchedule | WSchedule)[],
  edicao: EdicaoJwpub,
): { semanas: SemanaWeb[]; ignoradas: number } {
  const semanas: SemanaWeb[] = [];
  let ignoradas = 0;
  for (const item of bruto) {
    if (!ehSemanaMwb(item)) {
      ignoradas += 1;
      continue;
    }
    try {
      const semana = mapearSemanaJwpub(item, edicao);
      if (semana) semanas.push(semana);
      else ignoradas += 1;
    } catch {
      ignoradas += 1;
    }
  }
  return { semanas, ignoradas };
}
