// Interpreta as linhas já extraídas do PDF da apostila (ver extrair.ts) e
// monta a mesma estrutura que o antigo scraper de wol.jw.org produzia
// (`SemanaWeb`), para manter retrocompatibilidade total com o resto do
// app — banco, balanceador, impressão.
//
// Uma semana pode ocupar mais de uma página (o conteúdo estoura para a
// página seguinte quando não cabe) e o fim do livreto tem páginas de
// apêndice ("Veja a p. X") que repetem o intervalo de datas de uma semana
// já processada sem o abrir "Cântico N e oração Comentários iniciais" —
// por isso o início/fim de cada semana é demarcado por esses dois textos
// fixos, não pelo cabeçalho de datas sozinho (ver `EhInicioDeSemana`).

import { anoEBimestreDoTitulo, interpretarCabecalho, semanaIso } from "./datas";
import type { PaginaTexto } from "./extrair";
import type { ParteWeb, Secao, SemanaWeb, TipoParte } from "../types";

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Porta literal de `classificar` em `src-tauri/src/wol/parser.rs`
 * (removido junto com o scraping) — mesmas regras, mesma ordem. Comparação
 * sem acento de propósito: o PDF ocasionalmente perde algum acento na
 * extração (limitação da fonte usada na apostila), e a classificação não
 * pode depender disso. */
export function classificar(
  secao: Secao,
  titulo: string,
  descricao: string,
): { tipo: TipoParte; tem_ajudante: boolean } {
  const t = normalizar(titulo);
  const d = normalizar(descricao);
  switch (secao) {
    case "tesouros":
      if (t.includes("joias espirituais")) return { tipo: "joias", tem_ajudante: false };
      if (t.includes("leitura da biblia")) return { tipo: "leitura", tem_ajudante: false };
      return { tipo: "tesouros", tem_ajudante: false };
    case "ministerio":
      if (t.includes("consideracao") || d.includes("consideracao")) {
        // "Consideração" é uma parte falada com a assistência, não um
        // exercício de dois estudantes — cabe a ancião ou servo, igual às
        // partes de Tesouros/Vida Cristã.
        return { tipo: "ministerio_consideracao", tem_ajudante: false };
      }
      if (t.includes("discurso") || d.includes("discurso")) {
        return { tipo: "ministerio_discurso", tem_ajudante: false };
      }
      return { tipo: "ministerio_demonstracao", tem_ajudante: true };
    case "vida_crista":
      if (t.includes("estudo biblico de congregacao")) {
        return { tipo: "estudo_biblico", tem_ajudante: false };
      }
      if (t.includes("necessidades locais") || d.includes("necessidades locais")) {
        return { tipo: "necessidades_locais", tem_ajudante: false };
      }
      if (
        t.includes("ancia") ||
        d.includes("ancia") ||
        t.includes("superintendente") ||
        d.includes("superintendente")
      ) {
        return { tipo: "vida_crista_ancioes", tem_ajudante: false };
      }
      return { tipo: "vida_crista", tem_ajudante: false };
  }
}

/** Junta linhas quebradas pela paginação física do PDF, desfazendo a
 * hifenização de quebra de linha (ex.: "miseri-" + "córdia" → "misericórdia")
 * e inserindo espaço nos demais casos. */
function juntarLinhas(linhas: string[]): string {
  let out = "";
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i].trim();
    if (!linha) continue;
    if (!out) {
      out = linha;
      continue;
    }
    const quebraDeHifen = /\p{Ll}-$/u.test(out) && /^\p{Ll}/u.test(linha);
    out = quebraDeHifen ? out.slice(0, -1) + linha : `${out} ${linha}`;
  }
  return out.replace(/\s+/g, " ").trim();
}

function extrairCantico(texto: string): number | null {
  const m = /c[âa]ntico\s+(\d+)/i.exec(texto);
  return m ? Number(m[1]) : null;
}

const MARCADORES_TESOUROS = ["tesouros da"];
const MARCADORES_MINISTERIO = ["faca seu melhor", "no ministerio"];
const MARCADORES_VIDA_CRISTA = ["nossa", "vida crista"];

interface SemanaEmConstrucao {
  inicio: Date;
  intervalo_texto: string;
  leitura_semanal: string;
  cantico_inicial: number | null;
}

/** Monta as partes de uma semana a partir das linhas de corpo acumuladas
 * entre o "Comentários iniciais" e o "Comentários finais". */
function montarPartes(corpo: string[]): { partes: ParteWeb[]; cantico_meio: number | null } {
  let secaoAtual: Secao | null = null;
  let cantico_meio: number | null = null;
  const partes: ParteWeb[] = [];
  let ordem = 0;
  let numeroEsperado = 1;

  let numeroAtual: number | null = null;
  let secaoDaParteAtual: Secao | null = null;
  let linhasDaParteAtual: string[] = [];

  function fecharParteAtual() {
    if (numeroAtual == null || secaoDaParteAtual == null) return;
    const bruto = juntarLinhas(linhasDaParteAtual);
    const m = /\((\d+)\s*min\.?\)/.exec(bruto);
    const duracao_min = m ? Number(m[1]) : 0;
    const titulo = (m ? bruto.slice(0, m.index) : bruto)
      .trim()
      .replace(/[-–—]$/, "")
      .trim();
    const descricao = m ? bruto.slice(m.index).trim() : "";
    const { tipo, tem_ajudante } = classificar(secaoDaParteAtual, titulo, descricao);
    ordem += 1;
    partes.push({
      ordem,
      numero: numeroAtual,
      secao: secaoDaParteAtual,
      titulo,
      duracao_min,
      descricao,
      tipo,
      tem_ajudante,
    });
    numeroAtual = null;
    linhasDaParteAtual = [];
  }

  for (const linhaOriginal of corpo) {
    const linha = linhaOriginal.trim();
    const norm = normalizar(linha);

    if (MARCADORES_TESOUROS.includes(norm)) {
      fecharParteAtual();
      secaoAtual = "tesouros";
      continue;
    }
    if (MARCADORES_MINISTERIO.includes(norm)) {
      fecharParteAtual();
      secaoAtual = "ministerio";
      continue;
    }
    if (MARCADORES_VIDA_CRISTA.includes(norm)) {
      fecharParteAtual();
      secaoAtual = "vida_crista";
      continue;
    }

    const cm = /^cantico\s+(\d+)$/.exec(norm);
    if (
      cm &&
      secaoAtual === "vida_crista" &&
      cantico_meio == null &&
      !partes.some((p) => p.secao === "vida_crista")
    ) {
      cantico_meio = Number(cm[1]);
      continue;
    }

    // Só considera início de parte nova quando o número é exatamente o
    // próximo esperado (1, 2, 3, ...) — evita confundir uma referência
    // bíblica que comece uma linha ("50. ...") com um cabeçalho de parte.
    const pm = /^(\d+)\.\s+(\S.*)$/.exec(linha);
    if (pm && secaoAtual && Number(pm[1]) === numeroEsperado) {
      fecharParteAtual();
      numeroAtual = numeroEsperado;
      secaoDaParteAtual = secaoAtual;
      linhasDaParteAtual = [pm[2]];
      numeroEsperado += 1;
      continue;
    }

    if (numeroAtual != null) linhasDaParteAtual.push(linha);
  }
  fecharParteAtual();

  return { partes, cantico_meio };
}

const MAX_LINHAS_CABECALHO = 3;

function registrarLinha(ultimas: string[], texto: string): void {
  ultimas.push(texto);
  if (ultimas.length > MAX_LINHAS_CABECALHO) ultimas.shift();
}

/** Tenta interpretar o cabeçalho de datas a partir da(s) última(s) linha(s)
 * antes do gatilho de início — sozinha, ou grudada com a linha anterior
 * (o cabeçalho quebra em duas quando o intervalo cruza o mês, ex.:
 * "30 DE NOVEMBRO–6 DE DEZEMBRO" numa linha e "EZEQUIEL 1-2" na seguinte). */
function candidatosCabecalho(ultimasLinhas: string[], anoBase: number) {
  for (let n = 1; n <= ultimasLinhas.length; n++) {
    const texto = ultimasLinhas.slice(-n).join(" ");
    const cab = interpretarCabecalho(texto, anoBase);
    if (cab) return cab;
  }
  return null;
}

function ehInicioDeSemana(textoNormalizado: string): boolean {
  return textoNormalizado.includes("comentarios iniciais") && /cantico\s+\d+/.test(textoNormalizado);
}

function ehFimDeSemana(textoNormalizado: string): boolean {
  return textoNormalizado.includes("comentarios finais") && /cantico\s+\d+/.test(textoNormalizado);
}

/** Interpreta o PDF inteiro (já extraído em `PaginaTexto[]`) e devolve as
 * semanas no mesmo formato que `importar_semanas` produzia. `tituloPdf` é
 * o metadado `Title` do documento (ex.: "mwb26.11-T"), usado para saber o
 * ano/bimestre — os cabeçalhos de página nunca repetem o ano. */
export function parsearApostila(paginas: PaginaTexto[], tituloPdf: string): SemanaWeb[] {
  const meta = anoEBimestreDoTitulo(tituloPdf);
  if (!meta) {
    throw new Error(
      `Não foi possível identificar o ano/edição pelo metadado do PDF ("${tituloPdf}"). ` +
        "Confirme que o arquivo é a apostila mwb baixada direto do jw.org.",
    );
  }

  const resultado: SemanaWeb[] = [];
  let atual: SemanaEmConstrucao | null = null;
  let corpoAtual: string[] = [];
  // O cabeçalho de datas nem sempre é largo o bastante para cruzar o meio
  // da página (ex.: "9-15 DE NOVEMBRO" é bem mais curto que "2-8 DE
  // NOVEMBRO ... 2", com o número de página colado) — então não dá pra
  // confiar em "largura total" pra achar essa linha, só na adjacência: ela
  // é sempre uma das poucas linhas imediatamente anteriores ao gatilho de
  // início (às vezes o cabeçalho quebra em duas, ex.: data numa linha e
  // "EZEQUIEL 1-2" na seguinte, quando o intervalo cruza o mês).
  const ultimasLinhas: string[] = [];

  for (const pagina of paginas) {
    for (const linha of pagina.linhas) {
      const norm = normalizar(linha.texto);

      if (linha.larguraTotal && ehInicioDeSemana(norm)) {
        const cab = candidatosCabecalho(ultimasLinhas, meta.ano);
        if (cab) {
          atual = {
            inicio: cab.inicio,
            intervalo_texto: cab.intervalo_texto,
            leitura_semanal: cab.leitura_semanal,
            cantico_inicial: extrairCantico(linha.texto),
          };
          corpoAtual = [];
        }
        registrarLinha(ultimasLinhas, linha.texto);
        continue;
      }

      if (linha.larguraTotal && ehFimDeSemana(norm)) {
        if (atual) {
          const { ano, semana_iso } = semanaIso(atual.inicio);
          const { partes, cantico_meio } = montarPartes(corpoAtual);
          resultado.push({
            ano,
            semana_iso,
            doc_id: `mwb:${ano}-${semana_iso}`,
            intervalo_texto: atual.intervalo_texto,
            leitura_semanal: atual.leitura_semanal,
            cantico_inicial: atual.cantico_inicial,
            cantico_meio,
            cantico_final: extrairCantico(linha.texto),
            partes,
          });
        }
        atual = null;
        corpoAtual = [];
        registrarLinha(ultimasLinhas, linha.texto);
        continue;
      }

      if (atual) corpoAtual.push(linha.texto);
      registrarLinha(ultimasLinhas, linha.texto);
    }
  }

  return resultado;
}
