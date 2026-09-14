// Ponto de entrada dos parsers da apostila — usado pela tela de importação.
// Substitui o antigo scraping de wol.jw.org: o usuário baixa o arquivo
// (PDF ou .jwpub) direto do jw.org e importa aqui; nada é buscado pela
// rede. `importarApostila()` decide o parser pela extensão do arquivo; o
// caminho .jwpub é importado dinamicamente (ver `jwpub.ts`) para não pesar
// o bundle do caminho PDF com as dependências dele (jszip, sql.js, pako).

import { abrirDocumento, extrairPaginasDoDocumento } from "./extrair";
import { parsearApostila } from "./parse";
import { validarMetadados, validarSemanasEncontradas, ErroValidacaoApostila } from "./validar";
import type { SemanaWeb } from "../types";

export { ErroValidacaoApostila };
export type { MetadadosApostila } from "./validar";

export interface ResultadoImportacao {
  semanas: SemanaWeb[];
  aviso: string | null;
}

/** Lê, valida e interpreta o PDF da apostila, devolvendo as semanas no
 * mesmo formato que o antigo comando `importar_semanas` produzia — pronto
 * para `importarSemanas()` em `src/lib/db.ts`. */
export async function importarApostilaPdf(
  bytes: Uint8Array,
  congregacaoSinais: boolean,
): Promise<ResultadoImportacao> {
  if (bytes.length < 5 || String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-") {
    throw new ErroValidacaoApostila("O arquivo selecionado não é um PDF.");
  }

  // Um único `getDocument`: ele transfere o buffer por trás de `bytes`, e
  // abrir o documento de novo com os mesmos bytes falha silenciosamente.
  const doc = await abrirDocumento(bytes);
  const meta = await validarMetadados(doc, congregacaoSinais);
  const paginas = await extrairPaginasDoDocumento(doc);
  const semanas = parsearApostila(paginas, meta.titulo);
  validarSemanasEncontradas(semanas.length);
  return { semanas, aviso: meta.aviso };
}

/** Decide o parser pela extensão do arquivo — `.jwpub` (recomendado) ou
 * `.pdf` (alternativa) — e devolve as semanas no mesmo formato para os
 * dois casos. */
export async function importarApostila(arquivo: File, congregacaoSinais: boolean): Promise<ResultadoImportacao> {
  const nome = arquivo.name.toLowerCase();
  if (nome.endsWith(".jwpub")) {
    const { importarApostilaJwpub } = await import("./jwpub");
    return importarApostilaJwpub(arquivo, congregacaoSinais);
  }
  if (nome.endsWith(".pdf") || arquivo.type === "application/pdf") {
    return importarApostilaPdf(new Uint8Array(await arquivo.arrayBuffer()), congregacaoSinais);
  }
  throw new ErroValidacaoApostila("Selecione o arquivo .jwpub ou o PDF da apostila baixado do jw.org.");
}
