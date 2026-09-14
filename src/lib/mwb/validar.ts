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

/** Sufixo de idioma que o jw.org usa no nome/metadado dos PDFs da mwb.
 * Melhor esforço: se o padrão mudar ou não bater, simplesmente não
 * emitimos aviso algum (nunca bloqueamos por causa disso). */
const SUFIXO_PORTUGUES = "T";
const SUFIXO_LIBRAS = "BZS";

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
  let aviso: string | null = null;
  if (congregacaoSinais && sufixo === SUFIXO_PORTUGUES) {
    aviso =
      "Este PDF parece ser a edição em português, mas a congregação está configurada para Libras — confira se baixou o arquivo certo.";
  } else if (!congregacaoSinais && sufixo === SUFIXO_LIBRAS) {
    aviso =
      "Este PDF parece ser a edição em Libras, mas a congregação está configurada para português — confira se baixou o arquivo certo.";
  }

  return { titulo, ano: meta.ano, bimestreInicial: meta.bimestreInicial, aviso };
}

export function validarSemanasEncontradas(quantidade: number): void {
  if (quantidade === 0) {
    throw new ErroValidacaoApostila(
      "Não foi possível reconhecer nenhuma semana neste PDF. Confira se o arquivo não está corrompido.",
    );
  }
}
