// Validações de entrada antes/depois do parsing — mensagens claras para a
// tela de importação, sem gastar tempo processando um arquivo obviamente
// errado.

import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { anoEBimestreDoTitulo } from "./datas";
import { extrairMetadadosDoDocumento } from "./extrair";

export class ErroValidacaoApostila extends Error {}

export interface MetadadosApostila {
  titulo: string;
  ano: number;
  bimestreInicial: number;
  /** Aviso não bloqueante — ex.: PDF parece ser da edição errada (Libras x
   * português) para a configuração da congregação. */
  aviso: string | null;
}

/** Código de idioma que o jw.org usa no nome/metadado dos arquivos da mwb —
 * o PDF traz `BZS` no metadado `Title`; o `.jwpub` traz `LSB` no nome do
 * arquivo (ver `jwpub.ts`). Melhor esforço: se o padrão mudar ou não bater,
 * simplesmente não emitimos aviso algum (nunca bloqueamos por causa disso). */
const SUFIXO_PORTUGUES = ["T"];
const SUFIXO_LIBRAS = ["BZS", "LSB"];

/** Aviso não bloqueante quando o código de idioma do arquivo não bate com a
 * configuração da congregação — mesma lógica para PDF e `.jwpub`. */
export function avisoDeEdicao(codigoIdioma: string, congregacaoSinais: boolean): string | null {
  const codigo = codigoIdioma.toUpperCase();
  if (congregacaoSinais && SUFIXO_PORTUGUES.includes(codigo)) {
    return "Este arquivo parece ser a edição em português, mas a congregação está configurada para Libras — confira se baixou o arquivo certo.";
  }
  if (!congregacaoSinais && SUFIXO_LIBRAS.includes(codigo)) {
    return "Este arquivo parece ser a edição em Libras, mas a congregação está configurada para português — confira se baixou o arquivo certo.";
  }
  return null;
}

export async function validarMetadados(
  doc: pdfjs.PDFDocumentProxy,
  congregacaoSinais: boolean,
): Promise<MetadadosApostila> {
  const info = await extrairMetadadosDoDocumento(doc);
  const titulo = typeof info.Title === "string" ? info.Title : "";
  const meta = anoEBimestreDoTitulo(titulo);
  if (!meta) {
    throw new ErroValidacaoApostila(
      "Este PDF não parece ser a apostila da reunião (mwb). Baixe o arquivo direto do jw.org e tente de novo.",
    );
  }

  const sufixo = titulo.split("-").pop()?.toUpperCase() ?? "";
  const aviso = avisoDeEdicao(sufixo, congregacaoSinais);

  return { titulo, ano: meta.ano, bimestreInicial: meta.bimestreInicial, aviso };
}

/** Nome de arquivo que o jw.org usa para a apostila em `.jwpub`/`.epub`,
 * ex.: `mwb_T_202601.jwpub` — `T` é o código de idioma (português do
 * Brasil), `2026` o ano e `01` o mês (bimestral, sempre ímpar). */
const RE_NOME_MWB_JWPUB = /^mwb_([A-Za-z]{1,3})_(20\d{2})(0[1-9]|1[0-2])\.jwpub$/;
const RE_NOME_W_JWPUB = /^w_[A-Za-z]{1,3}_20\d{2}(0[1-9]|1[0-2])\.jwpub$/i;

/** A lib `meeting-schedules-parser` só interpreta corretamente apostilas a
 * partir de janeiro de 2024 — edições anteriores usavam outro layout. */
const PRIMEIRA_EDICAO_SUPORTADA = 202401;

export interface EdicaoJwpubValidada {
  ano: number;
  mes: number;
  idioma: string;
}

/** Valida o nome do arquivo `.jwpub` antes de abri-lo — evita expor as
 * mensagens em inglês da lib e cobre o caso comum de o usuário renomear o
 * arquivo baixado. Não abre nem lê o conteúdo. */
export function validarNomeArquivoJwpub(nome: string): EdicaoJwpubValidada {
  if (RE_NOME_W_JWPUB.test(nome)) {
    throw new ErroValidacaoApostila(
      "Este é o arquivo da Sentinela (A Sentinela — Estudo) — o app importa apenas a apostila da reunião (mwb).",
    );
  }
  const m = RE_NOME_MWB_JWPUB.exec(nome);
  if (!m) {
    throw new ErroValidacaoApostila(
      "Este arquivo não parece ser a apostila da reunião em .jwpub. Baixe direto do jw.org e não renomeie o " +
        'arquivo — o nome precisa ser parecido com "mwb_T_202601.jwpub".',
    );
  }
  const ano = Number(m[2]);
  const mes = Number(m[3]);
  if (ano * 100 + mes < PRIMEIRA_EDICAO_SUPORTADA) {
    throw new ErroValidacaoApostila(
      "Só é possível importar apostilas .jwpub de janeiro de 2024 em diante. Para edições mais antigas, use o PDF.",
    );
  }
  return { ano, mes, idioma: m[1].toUpperCase() };
}

/** Traduz os erros que a lib `meeting-schedules-parser` lança (em inglês)
 * para mensagens claras em pt-BR — melhor esforço por casamento de texto,
 * já que a lib não expõe códigos de erro. */
export function traduzirErroJwpub(erro: unknown): string {
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  if (/incorrect naming/i.test(mensagem)) {
    return "O nome do arquivo .jwpub foi alterado. Baixe o arquivo de novo, sem renomear.";
  }
  if (/only supported for Meeting Workbook/i.test(mensagem)) {
    return "Só é possível importar apostilas .jwpub de janeiro de 2024 em diante. Para edições mais antigas, use o PDF.";
  }
  if (/not a valid|Parsing failed|invalid/i.test(mensagem)) {
    return "Este arquivo .jwpub parece estar corrompido ou não é a apostila da reunião.";
  }
  if (/size seems to be large|more files than expected|suspicious/i.test(mensagem)) {
    return "Este arquivo não parece ser uma apostila válida — confira se baixou o arquivo certo direto do jw.org.";
  }
  return "Não foi possível ler o arquivo .jwpub. Confira se o arquivo não está corrompido e tente baixar de novo.";
}

export function validarSemanasEncontradas(quantidade: number): void {
  if (quantidade === 0) {
    throw new ErroValidacaoApostila(
      "Não foi possível reconhecer nenhuma semana neste PDF. Confira se o arquivo não está corrompido.",
    );
  }
}
