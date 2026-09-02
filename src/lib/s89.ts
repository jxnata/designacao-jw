import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFNumber, PDFString, StandardFonts, rgb } from "pdf-lib";
import s89Url from "../assets/S-89_T.pdf?url";
import { SECAO_POR_TIPO } from "./secoes";
import type { Designacao, Parte, Pessoa } from "./types";

export interface DadosS89 {
  nome: string;
  ajudante: string; // "" quando não há ajudante
  data: string; // dd/MM/yyyy
  numeroParte: string;
}

const CAMPO_NOME = "900_1_Text_SanSerif";
const CAMPO_AJUDANTE = "900_2_Text_SanSerif";
const CAMPO_DATA = "900_3_Text_SanSerif";
const CAMPO_NUMERO = "900_4_Text_SanSerif";
const CAMPO_SALAO_PRINCIPAL = "900_5_CheckBox";

let bytesTemplateCache: ArrayBuffer | null = null;

async function carregarTemplate(): Promise<ArrayBuffer> {
  if (!bytesTemplateCache) {
    const resposta = await fetch(s89Url);
    bytesTemplateCache = await resposta.arrayBuffer();
  }
  return bytesTemplateCache;
}

/**
 * Preenche uma via do formulário S-89 (designação individual do estudante)
 * a partir do template em `src/assets/S-89_T.pdf`.
 *
 * O template vem com `/AcroForm /Fields` vazio — os widgets só existem nos
 * `/Annots` da página — então antes de usar `pdfDoc.getForm()` é preciso
 * registrar a anotação de cada campo de texto no AcroForm. Também não há
 * aparências (`/AP`) nesses campos, então geramos as nossas com uma fonte
 * padrão.
 *
 * O checkbox "Salão principal" é tratado à parte, sem passar pelo
 * `PDFForm`/`flatten()`: a aparência "marcado" embutida no template
 * (`/AP /N /Yes`) tem um `/BBox` de ~74×71pt para um `/Rect` de ~10.5×10.5pt
 * — o documento conta com o Acrobat regenerando essa aparência na hora
 * (`/NeedAppearances true`) a partir do `/MK /CA`, e não com o `/AP`
 * gravado. Fora do Acrobat (Preview, Chrome, qualquer leitor que só respeite
 * o `/AP`) isso desenha uma marca gigante e fora de posição. Por isso lemos
 * o `/Rect` do widget diretamente, removemos a anotação da página e
 * desenhamos nosso próprio "X" no lugar, no conteúdo da página — funciona
 * igual em qualquer leitor.
 */
export async function gerarS89(dados: DadosS89): Promise<Uint8Array> {
  const templateBytes = await carregarTemplate();
  const pdfDoc = await PDFDocument.load(templateBytes);

  const pagina = pdfDoc.getPage(0);
  const anotacoes = pagina.node.Annots();
  const acroForm = pdfDoc.catalog.getOrCreateAcroForm();

  const camposDeTexto = new Set([CAMPO_NOME, CAMPO_AJUDANTE, CAMPO_DATA, CAMPO_NUMERO]);
  let retanguloSalaoPrincipal: { x: number; y: number; width: number; height: number } | null = null;

  if (anotacoes) {
    for (let i = anotacoes.size() - 1; i >= 0; i--) {
      const ref = anotacoes.get(i);
      const widget = pdfDoc.context.lookup(ref);
      if (!(widget instanceof PDFDict)) continue;
      const nomeCampoObj = widget.lookup(PDFName.of("T"));
      if (!(nomeCampoObj instanceof PDFHexString || nomeCampoObj instanceof PDFString)) continue;
      const nomeCampo = nomeCampoObj.decodeText();

      if (camposDeTexto.has(nomeCampo)) {
        acroForm.addField(ref as never);
      } else if (nomeCampo === CAMPO_SALAO_PRINCIPAL) {
        const rect = widget.lookup(PDFName.of("Rect"));
        if (rect instanceof PDFArray) {
          const [x0, y0, x1, y1] = rect.asArray().map((n) => (n as PDFNumber).asNumber());
          retanguloSalaoPrincipal = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
        }
        anotacoes.remove(i);
      }
    }
  }

  const form = pdfDoc.getForm();
  const fonte = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fonteNegrito = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  function definirTexto(nomeCampo: string, valor: string) {
    try {
      const campo = form.getTextField(nomeCampo);
      campo.setText(valor);
      campo.defaultUpdateAppearances(fonte);
    } catch (erro) {
      console.warn(`Campo "${nomeCampo}" não encontrado no S-89`, erro);
    }
  }

  definirTexto(CAMPO_NOME, dados.nome);
  definirTexto(CAMPO_AJUDANTE, dados.ajudante);
  definirTexto(CAMPO_DATA, dados.data);
  definirTexto(CAMPO_NUMERO, dados.numeroParte);

  if (retanguloSalaoPrincipal) {
    const { x, y, width, height } = retanguloSalaoPrincipal;
    const tamanho = Math.min(width, height) * 0.72;
    pagina.drawText("X", {
      x: x + (width - tamanho * 0.62) / 2,
      y: y + (height - tamanho * 0.72) / 2,
      size: tamanho,
      font: fonteNegrito,
      color: rgb(0, 0, 0),
    });
  } else {
    console.warn(`Checkbox "${CAMPO_SALAO_PRINCIPAL}" não encontrado no S-89`);
  }

  form.flatten();

  return pdfDoc.save();
}

/** Designação de estudante (leitura + Faça Seu Melhor no Ministério) para a
 * qual vale gerar um S-89: as únicas partes com formulário individual. */
export interface DesignacaoParaS89 {
  parte: Parte;
  designacao: Designacao;
}

/** Filtra, de uma semana, as designações que devem gerar um S-89: parte
 * da seção "ministerio" (leitura + discurso/demonstração/consideração) com
 * pessoa já designada. */
export function designacoesParaS89(partes: Parte[], designacoes: Designacao[]): DesignacaoParaS89[] {
  const porParteId = new Map(partes.map((p) => [p.id, p]));
  const resultado: DesignacaoParaS89[] = [];
  for (const designacao of designacoes) {
    if (designacao.parte_id == null || designacao.pessoa_id == null) continue;
    const parte = porParteId.get(designacao.parte_id);
    if (!parte || SECAO_POR_TIPO[parte.tipo] !== "ministerio") continue;
    resultado.push({ parte, designacao });
  }
  return resultado.sort((a, b) => a.parte.ordem - b.parte.ordem);
}

/** Monta os dados de preenchimento do S-89 a partir de uma designação. */
export function dadosS89DeDesignacao(
  item: DesignacaoParaS89,
  pessoasPorId: Map<number, Pessoa>,
  data: string,
): DadosS89 {
  const { parte, designacao } = item;
  const principal = designacao.pessoa_id ? (pessoasPorId.get(designacao.pessoa_id)?.nome ?? "") : "";
  const ajudante = designacao.ajudante_id ? (pessoasPorId.get(designacao.ajudante_id)?.nome ?? "") : "";
  return {
    nome: principal,
    ajudante,
    data,
    numeroParte: parte.numero != null ? String(parte.numero) : "",
  };
}
