// Lê o arquivo `.jwpub` da apostila (o mesmo que o JW Library usa) com a
// lib `meeting-schedules-parser` — zip → SQLite (sql.js/WASM) → HTML
// decriptado (crypto.subtle) → objetos `MWBSchedule`. Importado
// dinamicamente pelo dispatcher em `index.ts` para não pesar o bundle do
// caminho PDF com jszip + sql.js + pako.

import { avisoDeEdicao, ErroValidacaoApostila, traduzirErroJwpub, validarNomeArquivoJwpub, validarSemanasEncontradas } from "./validar";
import { mapearSemanasJwpub } from "./jwpub-mapear";
import type { SemanaWeb } from "../types";
import type { ResultadoImportacao } from "./index";

/** Lê, valida e interpreta o arquivo `.jwpub` da apostila, devolvendo as
 * semanas no mesmo formato que o parser de PDF produz. */
export async function importarApostilaJwpub(
  arquivo: File,
  congregacaoSinais: boolean,
): Promise<ResultadoImportacao> {
  const edicao = validarNomeArquivoJwpub(arquivo.name);
  const aviso = avisoDeEdicao(edicao.idioma, congregacaoSinais);

  const { loadPub } = await import("meeting-schedules-parser");

  let bruto: Awaited<ReturnType<typeof loadPub>>;
  try {
    bruto = await loadPub(arquivo);
  } catch (e) {
    throw new ErroValidacaoApostila(traduzirErroJwpub(e));
  }

  const { semanas } = mapearSemanasJwpub(bruto, edicao);
  validarSemanasEncontradas(semanas.length);
  return { semanas: semanas as SemanaWeb[], aviso };
}
