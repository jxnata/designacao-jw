// Ponto de entrada do parser da apostila (PDF) — usado pela tela de
// importação. Substitui o antigo scraping de wol.jw.org: o usuário baixa o
// PDF direto do jw.org e importa aqui; nada é buscado pela rede.

import { abrirDocumento, extrairPaginasDoDocumento } from "./extrair";
import { parsearApostila } from "./parse";
import { validarMetadados, validarSemanasEncontradas, ErroValidacaoApostila } from "./validar";
import type { SemanaWeb } from "../types";

export { ErroValidacaoApostila };
export type { MetadadosApostila } from "./validar";

export interface ResultadoImportacaoPdf {
  semanas: SemanaWeb[];
  aviso: string | null;
}

/** Lê, valida e interpreta o PDF da apostila, devolvendo as semanas no
 * mesmo formato que o antigo comando `importar_semanas` produzia — pronto
 * para `importarSemanas()` em `src/lib/db.ts`. */
export async function importarApostilaPdf(
  bytes: Uint8Array,
  congregacaoSinais: boolean,
): Promise<ResultadoImportacaoPdf> {
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
