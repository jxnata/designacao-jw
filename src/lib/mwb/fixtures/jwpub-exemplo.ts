// Amostra de `MWBSchedule` no formato que a lib `meeting-schedules-parser`
// devolve para o `.jwpub` em português do Brasil (enhanced parsing, código
// de idioma "T") — usada só nos testes de `jwpub-mapear.test.ts`, para não
// depender de um arquivo `.jwpub` real (que exige sql.js/WASM em runtime).
// Valores construídos a partir do formato descrito no README da lib,
// traduzidos e ajustados para os cenários que o mapeamento precisa cobrir.

import type { MWBSchedule } from "meeting-schedules-parser";

/** Semana comum: 4 partes de Ministério, 1 de Vida Cristã (+ EBC). */
export const SEMANA_COMUM: MWBSchedule = {
  mwb_week_date: "2026/03/02",
  mwb_week_date_locale: "2-8 DE MARÇO",
  mwb_weekly_bible_reading: "SALMO 105",
  mwb_song_first: 3,
  mwb_tgw_talk: "“Ele se lembra do seu pacto para sempre”",
  mwb_tgw_talk_title: "1. “Ele se lembra do seu pacto para sempre”",
  mwb_tgw_gems_title: "2. Joias espirituais",
  mwb_tgw_bread: "Sl 105:24-45 (th lição 5)",
  mwb_tgw_bread_title: "3. Leitura da Bíblia",
  mwb_ayf_count: 4,
  mwb_ayf_part1: "DE CASA EM CASA. O morador está ocupado. (lmd lição 2 ponto 5)",
  mwb_ayf_part1_time: 3,
  mwb_ayf_part1_type: "Iniciando conversas",
  mwb_ayf_part1_title: "4. Iniciando conversas",
  mwb_ayf_part2: "DE CASA EM CASA. Faça um resumo da lição 1 ponto 4.",
  mwb_ayf_part2_time: 4,
  mwb_ayf_part2_type: "Cultivando o interesse",
  mwb_ayf_part2_title: "5. Cultivando o interesse",
  mwb_ayf_part3: "Explique o que a Bíblia diz sobre a esperança da ressurreição.",
  mwb_ayf_part3_time: 5,
  mwb_ayf_part3_type: "Explicando suas crenças",
  mwb_ayf_part3_title: "6. Explicando suas crenças",
  mwb_ayf_part4: "Baseado na lição 2 da apostila Ame as Pessoas.",
  mwb_ayf_part4_time: 5,
  mwb_ayf_part4_type: "Discurso",
  mwb_ayf_part4_title: "7. Discurso",
  mwb_song_middle: 84,
  mwb_lc_count: 1,
  mwb_lc_part1: "Expressões do seu amor",
  mwb_lc_part1_time: 15,
  mwb_lc_part1_content: "Vídeo e consideração.",
  mwb_lc_part1_title: "8. Expressões do seu amor",
  mwb_lc_part2: "",
  mwb_lc_cbs: "bt cap. 17 §13-19",
  mwb_lc_cbs_title: "9. Estudo bíblico de congregação",
  mwb_song_conclude: 97,
};

/** Semana com 2 partes de Vida Cristã, incluindo "Necessidades locais". */
export const SEMANA_COM_NECESSIDADES_LOCAIS: MWBSchedule = {
  ...SEMANA_COMUM,
  mwb_week_date: "2026/03/09",
  mwb_week_date_locale: "9-15 DE MARÇO",
  mwb_lc_count: 2,
  mwb_lc_part1: "Anciãos qualificados",
  mwb_lc_part1_time: 15,
  mwb_lc_part1_content: "Discurso.",
  mwb_lc_part1_title: "8. Anciãos qualificados",
  mwb_lc_part2: "Necessidades locais",
  mwb_lc_part2_time: 5,
  mwb_lc_part2_content: "",
  mwb_lc_part2_title: "9. Necessidades locais",
  mwb_lc_cbs_title: "10. Estudo bíblico de congregação",
};

/** Semana cruzando o mês (novembro→dezembro). */
export const SEMANA_CRUZANDO_MES: MWBSchedule = {
  ...SEMANA_COMUM,
  mwb_week_date: "2026/11/30",
  mwb_week_date_locale: "30 DE NOVEMBRO–6 DE DEZEMBRO",
};

/** Semana da primeira edição do ano, começando em dezembro do ano anterior
 * — cobre o ajuste de ano em `datasDaSemana()`. */
export const SEMANA_VIRADA_DE_ANO: MWBSchedule = {
  ...SEMANA_COMUM,
  mwb_week_date: "2026/12/28",
  mwb_week_date_locale: "28 DE DEZEMBRO–3 DE JANEIRO",
};
