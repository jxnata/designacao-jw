// Extração de texto do PDF da apostila (mwb) preservando a ordem de leitura
// (duas colunas por página) e recompondo acentos, que o PDF publica como
// glifos combinantes soltos, sobrepostos ao caractere-base.
//
// Este módulo só lida com geometria de página — nada de regras de negócio
// da apostila (isso fica em parse.ts). É usado apenas no frontend: não há
// parser de PDF confiável em Rust para este caso (ver README/CLAUDE.md).

import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
// eslint-disable-next-line import/no-unresolved -- resolvido pelo Vite (?url)
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// Só faz sentido apontar para o worker de verdade rodando no navegador
// (webview do Tauri) — em Node (testes) o pdf.js roda sozinho, no mesmo
// thread, e um workerSrc inválido quebraria esse fallback.
if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
}

/** Marcas de acento combinantes que este PDF publica como glifos soltos,
 * posicionados sobre o caractere-base em vez de dentro dele. */
const ACENTOS: Record<string, string> = {
  "´": "́", // agudo
  "`": "̀", // grave
  ˆ: "̂", // circunflexo
  "˜": "̃", // til
  "¨": "̈", // trema
  "¸": "̧", // cedilha
  "˚": "̊", // anel
  ˇ: "̌", // caron
};

function ehGlifoDeAcento(str: string): boolean {
  const t = str.trim();
  return t.length > 0 && [...t].every((c) => ACENTOS[c] !== undefined);
}

interface ItemBase {
  s: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ItemMesclado extends ItemBase {
  acentoNoInicio: boolean;
  acentoNoFim: boolean;
}

/** Funde os glifos de acento nos caracteres-base mais próximos em x,
 * inclusive quando o item de acento pertence a um item batido em lote
 * (ex.: "Coment" + "´" + "arios" → "Comentários"). O caractere sem ponto
 * "ı"/"İ" que a fonte usa como base para í/Í quando acentuado também é
 * normalizado aqui. */
function mesclarAcentos(itensBase: ItemBase[], acentos: ItemBase[]): ItemMesclado[] {
  const posicoesChar: { itemIdx: number; charIdx: number; x: number }[] = [];
  for (let i = 0; i < itensBase.length; i++) {
    const it = itensBase[i];
    const n = it.s.length;
    const larguraPorChar = it.w / Math.max(n, 1);
    for (let k = 0; k < n; k++) {
      posicoesChar.push({ itemIdx: i, charIdx: k, x: it.x + (k + 0.5) * larguraPorChar });
    }
  }

  const chars = itensBase.map((it) => it.s.split(""));
  const acentoNoInicio = itensBase.map(() => false);
  const acentoNoFim = itensBase.map(() => false);

  for (const acento of acentos) {
    let melhor: (typeof posicoesChar)[number] | null = null;
    let menorDist = Infinity;
    for (const c of posicoesChar) {
      const d = Math.abs(c.x - acento.x);
      if (d < menorDist) {
        menorDist = d;
        melhor = c;
      }
    }
    if (melhor && menorDist < 5) {
      let base = chars[melhor.itemIdx][melhor.charIdx];
      if (base === "ı") base = "i"; // ı sem ponto usado como base de í
      if (base === "İ") base = "I"; // İ usado como base de Í
      chars[melhor.itemIdx][melhor.charIdx] = (base + ACENTOS[acento.s.trim()]).normalize("NFC");
      if (melhor.charIdx === 0) acentoNoInicio[melhor.itemIdx] = true;
      if (melhor.charIdx === chars[melhor.itemIdx].length - 1) acentoNoFim[melhor.itemIdx] = true;
    }
  }

  return itensBase.map((it, i) => ({
    ...it,
    s: chars[i].join(""),
    acentoNoInicio: acentoNoInicio[i],
    acentoNoFim: acentoNoFim[i],
  }));
}

/** Concatena os itens de uma linha inserindo espaço só quando o vão entre
 * dois itens consecutivos é proporcionalmente maior que o normal — os
 * títulos em caixa alta têm tracking largo, e o threshold relativo ao
 * tamanho da fonte evita confundir isso com espaço de verdade. */
function montarTextoDaLinha(itens: ItemMesclado[]): string {
  const ordenados = [...itens].sort((a, b) => a.x - b.x);
  let texto = "";
  for (let i = 0; i < ordenados.length; i++) {
    const item = ordenados[i];
    if (i > 0) {
      const anterior = ordenados[i - 1];
      const vao = item.x - (anterior.x + anterior.w);
      const limite = Math.max(anterior.h, item.h) * 0.22;
      if (vao > limite) texto += " ";
    }
    texto += item.s;
  }
  return texto
    .replace(/ı/g, "i")
    .replace(/İ/g, "I")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export interface LinhaPagina {
  texto: string;
  larguraTotal: boolean;
}

export interface PaginaTexto {
  pagina: number;
  linhas: LinhaPagina[];
}

interface LinhaBruta {
  y: number;
  h: number;
  itens: ItemBase[];
  acentos: ItemBase[];
}

async function extrairLinhasDaPagina(page: pdfjs.PDFPageProxy): Promise<LinhaPagina[]> {
  const viewport = page.getViewport({ scale: 1 });
  const conteudo = await page.getTextContent();

  interface TextItemComTransform {
    str: string;
    transform: number[];
    width: number;
    height: number;
  }

  const todos: ItemBase[] = (conteudo.items as unknown as TextItemComTransform[])
    .filter(
      (i) =>
        // Descarta também glifos decorativos (ícones, filetes/traços de
        // divisão) que a fonte mapeia para caracteres de controle — não são
        // texto de verdade, e formam uma linha só deles que pode virar o
        // "cabeçalho" mais próximo por engano.
        i.str !== undefined && i.str.trim() !== "" && !/^[\x00-\x1f]+$/.test(i.str),
    )
    .map((i) => ({
      s: i.str,
      x: i.transform[4],
      y: i.transform[5],
      w: i.width,
      h: i.height || 10,
    }));

  const base = todos.filter((i) => !ehGlifoDeAcento(i.s));
  const acentos = todos.filter((i) => ehGlifoDeAcento(i.s));

  // Agrupa itens-base em linhas por proximidade de y (mesma linha visual).
  const linhas: LinhaBruta[] = [];
  for (const item of base.sort((a, b) => b.y - a.y || a.x - b.x)) {
    const linha = linhas.find((l) => Math.abs(l.y - item.y) <= 2.5 && Math.abs(l.h - item.h) < 6);
    if (linha) linha.itens.push(item);
    else linhas.push({ y: item.y, h: item.h, itens: [item], acentos: [] });
  }

  // Anexa cada acento à linha correta: acentos ficam ACIMA do próprio
  // caractere-base, então a distância (acento.y - linha.y) deve ser
  // pequena e positiva — nunca negativa (abaixo) nem grande demais (linha
  // vizinha, especialmente em títulos de duas linhas com pouco espaçamento).
  for (const acento of acentos) {
    let melhor: LinhaBruta | null = null;
    let menorDist = Infinity;
    for (const linha of linhas) {
      const d = acento.y - linha.y;
      if (d > -1.5 && d < linha.h * 0.9 && d < menorDist) {
        menorDist = d;
        melhor = linha;
      }
    }
    melhor?.acentos.push(acento);
  }

  const meio = viewport.width / 2;
  interface Linha {
    y: number;
    larguraTotal: boolean;
    coluna: 0 | 1;
    texto: string;
  }
  const resultado: Linha[] = [];

  for (const linha of linhas) {
    const mesclados = mesclarAcentos(
      linha.itens.sort((a, b) => a.x - b.x),
      linha.acentos,
    );

    // Se houver um vão largo cruzando o meio da página, a linha é na
    // verdade duas colunas independentes que calharam de ter a mesma
    // altura — corta ali.
    let indiceCorte = -1;
    for (let k = 1; k < mesclados.length; k++) {
      const anterior = mesclados[k - 1];
      const vao = mesclados[k].x - (anterior.x + anterior.w);
      if (vao > 16 && anterior.x + anterior.w < meio + 2 && mesclados[k].x > meio - 2) {
        indiceCorte = k;
        break;
      }
    }

    if (indiceCorte > 0) {
      resultado.push({
        y: linha.y,
        larguraTotal: false,
        coluna: 0,
        texto: montarTextoDaLinha(mesclados.slice(0, indiceCorte)),
      });
      resultado.push({
        y: linha.y,
        larguraTotal: false,
        coluna: 1,
        texto: montarTextoDaLinha(mesclados.slice(indiceCorte)),
      });
    } else {
      const primeiro = mesclados[0];
      const ultimo = mesclados[mesclados.length - 1];
      const cruzaOMeio = primeiro.x < meio && ultimo.x + ultimo.w > meio;
      resultado.push({
        y: linha.y,
        larguraTotal: cruzaOMeio,
        coluna: primeiro.x >= meio ? 1 : 0,
        texto: montarTextoDaLinha(mesclados),
      });
    }
  }

  // Ordem de leitura: de cima para baixo, acumulando cada coluna num
  // buffer; ao encontrar uma linha de largura total (banner, box de
  // considerações), esvazia os buffers (coluna esquerda inteira, depois a
  // direita) antes de emitir essa linha, e recomeça o acúmulo depois dela.
  resultado.sort((a, b) => b.y - a.y);
  const sequencia: LinhaPagina[] = [];
  let bufEsquerda: LinhaPagina[] = [];
  let bufDireita: LinhaPagina[] = [];
  const flush = () => {
    sequencia.push(...bufEsquerda, ...bufDireita);
    bufEsquerda = [];
    bufDireita = [];
  };
  for (const linha of resultado) {
    if (!linha.texto) continue;
    if (/^\d{1,3}$/.test(linha.texto)) continue; // número de página isolado
    if (linha.larguraTotal) {
      flush();
      sequencia.push({ texto: linha.texto, larguraTotal: true });
    } else if (linha.coluna === 0) {
      bufEsquerda.push({ texto: linha.texto, larguraTotal: false });
    } else {
      bufDireita.push({ texto: linha.texto, larguraTotal: false });
    }
  }
  flush();
  return sequencia;
}

/** Abre o PDF uma única vez. Importante: `getDocument` transfere (detacha)
 * o `ArrayBuffer` por trás de `bytes` para o worker — reabrir o documento
 * com o mesmo `bytes` uma segunda vez falha silenciosamente com
 * `DataCloneError`. Por isso metadados e páginas sempre saem do mesmo
 * `doc`, nunca de duas chamadas a `getDocument` com os mesmos bytes. */
export async function abrirDocumento(bytes: Uint8Array): Promise<pdfjs.PDFDocumentProxy> {
  return pdfjs.getDocument({ data: bytes }).promise;
}

/** Lê os metadados do documento (usado pela validação antes de gastar
 * tempo com a extração completa das páginas). */
export async function extrairMetadadosDoDocumento(
  doc: pdfjs.PDFDocumentProxy,
): Promise<Record<string, unknown>> {
  const meta = await doc.getMetadata();
  return (meta.info as Record<string, unknown>) ?? {};
}

/** Devolve, por página, as linhas de texto já na ordem de leitura correta
 * (título/rodapé de largura total, coluna esquerda, coluna direita), com
 * os acentos recompostos. */
export async function extrairPaginasDoDocumento(doc: pdfjs.PDFDocumentProxy): Promise<PaginaTexto[]> {
  const paginas: PaginaTexto[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    paginas.push({ pagina: p, linhas: await extrairLinhasDaPagina(page) });
  }
  return paginas;
}
